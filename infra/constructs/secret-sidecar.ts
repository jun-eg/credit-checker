import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

interface SecretSidecarProps {
  taskDefinition: ecs.FargateTaskDefinition;
  appSecret: secretsmanager.ISecret;
  sidecarImageUri: string;
  secretKeys: string[];
}

/**
 * Secrets Manager から /run/secrets/ へ書き込む sidecar コンテナと
 * main コンテナ間で共有するボリュームを追加する。
 *
 * sidecar は各シークレットキーの ARN を環境変数で受け取り、
 * ファイルに書き出したあと終了する（essential: false）。
 */
export class SecretSidecar extends Construct {
  readonly sharedVolume: ecs.Volume;

  constructor(scope: Construct, id: string, props: SecretSidecarProps) {
    super(scope, id);

    const { taskDefinition, appSecret, sidecarImageUri, secretKeys } = props;

    const volumeName = 'secrets-volume';
    taskDefinition.addVolume({ name: volumeName });
    this.sharedVolume = { name: volumeName };

    // sidecar に渡す環境変数（各シークレットキーの ARN）
    const environment: Record<string, string> = {};
    secretKeys.forEach((key) => {
      const envKey = `SECRET_${key.toUpperCase()}_ARN`;
      environment[envKey] = appSecret.secretArn;
    });

    const sidecar = taskDefinition.addContainer('secrets-fetcher', {
      image: ecs.ContainerImage.fromRegistry(sidecarImageUri),
      essential: false,
      environment,
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'secrets-fetcher' }),
    });

    sidecar.addMountPoints({
      containerPath: '/run/secrets',
      sourceVolume: volumeName,
      readOnly: false,
    });
  }
}
