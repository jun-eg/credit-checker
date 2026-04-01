import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config';

interface EdgeStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  certificate: acm.ICertificate;
  albSecurityGroup: ec2.SecurityGroup;
  frontendService: ecs.FargateService;
  backendService: ecs.FargateService;
}

export class EdgeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: EdgeStackProps) {
    super(scope, id, props);

    const { config, certificate, albSecurityGroup, frontendService, backendService } = props;
    const { ports } = config;

    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: config.domain.split('.').slice(-2).join('.'),
    });

    // ALB は ap-northeast-1 の証明書が必要（CloudFront 用の us-east-1 証明書とは別）
    const albCertificate = new acm.Certificate(this, 'AlbCertificate', {
      domainName: config.domain,
      subjectAlternativeNames: [`*.${config.domain}`],
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    const vpc = frontendService.cluster.vpc;
    const alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    // HTTP → HTTPS リダイレクト
    alb.addListener('HttpListener', {
      port: 80,
      defaultAction: elbv2.ListenerAction.redirect({
        protocol: 'HTTPS',
        port: '443',
        permanent: true,
      }),
    });

    const httpsListener = alb.addListener('HttpsListener', {
      port: 443,
      certificates: [albCertificate],
      defaultAction: elbv2.ListenerAction.fixedResponse(404),
    });

    // /api/v1/* → backend（/api/auth/* 等の Next.js ルートを誤ってバックエンドに転送しないよう v1 に限定）
    const backendTargetGroup = new elbv2.ApplicationTargetGroup(this, 'BackendTg', {
      vpc,
      port: ports.backend,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [backendService],
      healthCheck: {
        path: '/api/v1/health',
        interval: cdk.Duration.seconds(30),
      },
    });

    httpsListener.addAction('BackendAction', {
      priority: 10,
      conditions: [elbv2.ListenerCondition.pathPatterns(['/api/v1/*'])],
      action: elbv2.ListenerAction.forward([backendTargetGroup]),
    });

    // /* → frontend
    const frontendTargetGroup = new elbv2.ApplicationTargetGroup(this, 'FrontendTg', {
      vpc,
      port: ports.frontend,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [frontendService],
      healthCheck: {
        path: '/',
        interval: cdk.Duration.seconds(30),
      },
    });

    httpsListener.addAction('FrontendAction', {
      priority: 20,
      conditions: [elbv2.ListenerCondition.pathPatterns(['/*'])],
      action: elbv2.ListenerAction.forward([frontendTargetGroup]),
    });

    // CloudFront Distribution（ALB をオリジンとして使用）
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new origins.LoadBalancerV2Origin(alb, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        // Next.js Server Action は POST を使用するため ALL を許可する
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      },
      domainNames: [config.domain],
      certificate,
    });

    // Route53 A レコード → CloudFront
    new route53.ARecord(this, 'AliasRecord', {
      zone: hostedZone,
      recordName: config.domain,
      target: route53.RecordTarget.fromAlias(
        new route53Targets.CloudFrontTarget(distribution),
      ),
    });

    new cdk.CfnOutput(this, 'AlbDns', { value: alb.loadBalancerDnsName });
    new cdk.CfnOutput(this, 'CloudFrontDomain', { value: distribution.distributionDomainName });
  }
}
