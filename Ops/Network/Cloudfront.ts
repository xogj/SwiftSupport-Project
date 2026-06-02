import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'


export class SwiftSupportCloudfront extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const assetBucket = new s3.Bucket(this, 'SwiftSupportBucket', {
            bucketName: 'SwiftSupportBucket',
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            enforceSSL: true,
            versioned: true,
        })

        const distribution = new cloudfront.Distribution(this, 'SwiftSupportCloudFrontDistribution', {
            defaultBehavior: {
                origin: new origins.S3Origin(assetBucket),
                viewProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            }
        }
        }
}
