import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as s3 from 'aws-cdk-lib/aws-s3'

export class SwiftSupports3 extends cdk.Stack {
    public readonly assetBucket: s3.Bucket;
    public readonly accessLogsBucket: s3.Bucket;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        this.accessLogsBucket = new s3.Bucket(this, 'SwiftSupportAccessLogs', {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            enforceSSL: true,
            versioned: true,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            lifecycleRules: [{
                expiration: cdk.Duration.days(365),
                noncurrentVersionExpiration: cdk.Duration.days(90)
            }]
        });

        this.assetBucket = new s3.Bucket(this, 'SwiftSupportAssetBucket', {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            enforceSSL: true,
            versioned: true,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            serverAccessLogsBucket: this.accessLogsBucket,
            serverAccessLogsPrefix: 'asset-bucket/'
        });

        new cdk.CfnOutput(this, 'AssetBucketName', { value: this.assetBucket.bucketName });
    }
}
