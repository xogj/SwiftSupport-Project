import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as s3deployment from 'aws-cdk-lib/aws-s3-deployment'
import * as path from 'path'

export interface SwiftSupportCloudfrontProps extends cdk.StackProps {
    assetBucket: s3.IBucket;
    accessLogsBucket?: s3.IBucket;
    cloudFrontWebAclArn?: string;
    runtimeConfig: {
        apiBaseUrl: string;
        cognitoDomain: string;       // e.g. swiftsupport-123.auth.us-east-2.amazoncognito.com
        cognitoClientId: string;
        cognitoRegion: string;
    };
}

export class SwiftSupportCloudfront extends cdk.Stack {
    public readonly distribution: cloudfront.Distribution;

    constructor(scope: Construct, id: string, props: SwiftSupportCloudfrontProps) {
        super(scope, id, props);

        const origin = origins.S3BucketOrigin.withOriginAccessControl(props.assetBucket, {
            originAccessLevels: [cloudfront.AccessLevel.READ]
        });

        const securityHeaders = new cloudfront.ResponseHeadersPolicy(this, 'SwiftSupportSecurityHeaders', {
            responseHeadersPolicyName: 'SwiftSupport-Security-Headers',
            securityHeadersBehavior: {
                contentSecurityPolicy: {
                    contentSecurityPolicy: [
                        "default-src 'self'",
                        "img-src 'self' data:",
                        "script-src 'self'",
                        "style-src 'self' 'unsafe-inline'",
                        `connect-src 'self' ${props.runtimeConfig.apiBaseUrl} https://${props.runtimeConfig.cognitoDomain}`,
                        `form-action https://${props.runtimeConfig.cognitoDomain}`
                    ].join('; '),
                    override: true
                },
                contentTypeOptions: { override: true },
                frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
                referrerPolicy: { referrerPolicy: cloudfront.HeadersReferrerPolicy.SAME_ORIGIN, override: true },
                strictTransportSecurity: {
                    accessControlMaxAge: cdk.Duration.days(365),
                    includeSubdomains: true,
                    preload: true,
                    override: true
                },
                xssProtection: { protection: true, modeBlock: true, override: true }
            }
        });

        this.distribution = new cloudfront.Distribution(this, 'SwiftSupportCloudFrontDistribution', {
            comment: 'SwiftSupport SPA distribution',
            defaultRootObject: 'index.html',
            defaultBehavior: {
                origin,
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
                responseHeadersPolicy: securityHeaders
            },
            minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
            httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
            webAclId: props.cloudFrontWebAclArn,
            enableLogging: props.accessLogsBucket !== undefined,
            logBucket: props.accessLogsBucket,
            logFilePrefix: props.accessLogsBucket ? 'cloudfront/' : undefined,
            errorResponses: [
                { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
                { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' }
            ]
        });

        // Inject the real backend config into the SPA at deploy time.
        // The SPA loads config.js before app.js; without this, the frontend stays in mock mode.
        const configJs = `window.SWIFTSUPPORT_CONFIG = ${JSON.stringify({
            apiBaseUrl: props.runtimeConfig.apiBaseUrl,
            cognito: {
                domain: props.runtimeConfig.cognitoDomain,
                clientId: props.runtimeConfig.cognitoClientId,
                region: props.runtimeConfig.cognitoRegion,
                redirectUri: 'PLACEHOLDER_REDIRECT'
            }
        }, null, 2)};`;

        new s3deployment.BucketDeployment(this, 'DeploySpa', {
            sources: [
                s3deployment.Source.asset(path.join(__dirname, '..', '..', 'Frontend')),
                s3deployment.Source.data('config.js', configJs)
            ],
            destinationBucket: props.assetBucket,
            distribution: this.distribution,
            distributionPaths: ['/*'],
            prune: true
        });

        new cdk.CfnOutput(this, 'DistributionDomain', { value: this.distribution.distributionDomainName });
    }
}
