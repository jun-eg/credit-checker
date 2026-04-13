import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

interface CertificateStackProps extends cdk.StackProps {
  domain: string;
}

export class CertificateStack extends cdk.Stack {
  readonly certificate: acm.Certificate;

  constructor(scope: Construct, id: string, props: CertificateStackProps) {
    super(scope, id, props);

    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: props.domain.split('.').slice(-2).join('.'),
    });

    this.certificate = new acm.Certificate(this, 'Certificate', {
      domainName: props.domain,
      subjectAlternativeNames: [`*.${props.domain}`],
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });
  }
}
