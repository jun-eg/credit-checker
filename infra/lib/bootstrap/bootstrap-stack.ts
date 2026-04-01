import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

interface BootstrapStackProps extends cdk.StackProps {
  githubRepo: string; // 例: 'jun-eg/credit-checker'
}

export class BootstrapStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BootstrapStackProps) {
    super(scope, id, props);

    const { githubRepo } = props;

    // GitHub Actions の OIDC プロバイダー（アカウントに1つ）
    const oidcProvider = new iam.OpenIdConnectProvider(this, 'GitHubOidcProvider', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    });

    // GitHub Actions デプロイロール
    // CDK デプロイ（CloudFormation・IAM・VPC・RDS 等）を含む全操作が必要なため AdministratorAccess を付与
    new iam.Role(this, 'DeployRole', {
      roleName: 'github-actions-deploy-role',
      assumedBy: new iam.WebIdentityPrincipal(oidcProvider.openIdConnectProviderArn, {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
        },
        StringLike: {
          // 特定リポジトリからの assume のみ許可
          'token.actions.githubusercontent.com:sub': `repo:${githubRepo}:*`,
        },
      }),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'),
      ],
    });
  }
}
