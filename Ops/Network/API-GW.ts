import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as apigw from 'aws-cdk-lib/aws-apigateway'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as route53 from 'aws-cdk-lib/aws-route53'
import * as targets from 'aws-cdk-lib/aws-route53-targets'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as wafv2 from 'aws-cdk-lib/aws-wafv2'

export interface SwiftSupportDomainAPIProps extends cdk.StackProps {
    ticketHandler: lambda.IFunction;
    regionalWebAclArn: string;
    hostedZoneName?: string;
    apiSubdomain?: string;
}

export class SwiftSupportDomainAPI extends cdk.Stack {
    public readonly api: apigw.RestApi;
    public readonly apiUrl: string;
    public readonly userPool: cognito.UserPool;
    public readonly userPoolClient: cognito.UserPoolClient;
    public readonly userPoolDomain: cognito.UserPoolDomain;

    constructor(scope: Construct, id: string, props: SwiftSupportDomainAPIProps) {
        super(scope, id, props)

        const zoneName = props.hostedZoneName ?? 'swiftsupport.com'
        const subdomain = props.apiSubdomain ?? 'api'
        const domainName = `${subdomain}.${zoneName}`
        this.apiUrl = `https://${domainName}`
        const spaUrl = `https://${zoneName}`

        const hostedZone = route53.HostedZone.fromLookup(this, 'Zone', { domainName: zoneName })

        const certificate = new acm.Certificate(this, 'ApiCertificate', {
            domainName,
            validation: acm.CertificateValidation.fromDns(hostedZone)
        })

        const accessLogGroup = new logs.LogGroup(this, 'ApiAccessLogs', {
            retention: logs.RetentionDays.ONE_MONTH,
            removalPolicy: cdk.RemovalPolicy.RETAIN
        })

        this.api = new apigw.RestApi(this, 'SwiftSupportApigw', {
            restApiName: 'SwiftSupport-API',
            description: 'SwiftSupport ticket intake API',
            deployOptions: {
                stageName: 'prod',
                loggingLevel: apigw.MethodLoggingLevel.INFO,
                dataTraceEnabled: false,
                metricsEnabled: true,
                tracingEnabled: true,
                accessLogDestination: new apigw.LogGroupLogDestination(accessLogGroup),
                accessLogFormat: apigw.AccessLogFormat.jsonWithStandardFields()
            },
            defaultCorsPreflightOptions: {
                allowOrigins: [spaUrl, `https://www.${zoneName}`, 'http://127.0.0.1:8080', 'http://localhost:8080'],
                allowMethods: ['GET', 'POST', 'OPTIONS'],
                allowHeaders: ['Authorization', 'Content-Type']
            },
            cloudWatchRole: true
        })

        this.userPool = new cognito.UserPool(this, 'SwiftSupportUserPool', {
            userPoolName: 'SwiftSupport-Users',
            selfSignUpEnabled: true,
            signInAliases: { email: true },
            autoVerify: { email: true },
            standardAttributes: {
                email: { required: true, mutable: false },
                givenName: { required: false, mutable: true },
                familyName: { required: false, mutable: true }
            },
            mfa: cognito.Mfa.REQUIRED,
            mfaSecondFactor: { sms: false, otp: true },
            passwordPolicy: {
                minLength: 14,
                requireDigits: true,
                requireLowercase: true,
                requireUppercase: true,
                requireSymbols: true
            },
            accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
            removalPolicy: cdk.RemovalPolicy.RETAIN
        })

        this.userPoolDomain = this.userPool.addDomain('HostedUiDomain', {
            cognitoDomain: { domainPrefix: `swiftsupport-${this.account}` }
        })

        this.userPoolClient = this.userPool.addClient('SpaClient', {
            userPoolClientName: 'SwiftSupport-SPA',
            generateSecret: false,
            authFlows: { userSrp: true },
            preventUserExistenceErrors: true,
            oAuth: {
                flows: { authorizationCodeGrant: true },
                scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
                callbackUrls: [spaUrl, `https://www.${zoneName}`, 'http://127.0.0.1:8080/', 'http://localhost:8080/'],
                logoutUrls: [spaUrl, `https://www.${zoneName}`, 'http://127.0.0.1:8080/', 'http://localhost:8080/']
            },
            accessTokenValidity: cdk.Duration.hours(1),
            idTokenValidity: cdk.Duration.hours(1),
            refreshTokenValidity: cdk.Duration.days(30)
        })

        const authorizer = new apigw.CognitoUserPoolsAuthorizer(this, 'SwiftSupportAuthorizer', {
            cognitoUserPools: [this.userPool],
            identitySource: 'method.request.header.Authorization'
        })

        const lambdaIntegration = new apigw.LambdaIntegration(props.ticketHandler, { proxy: true })

        const tickets = this.api.root.addResource('tickets')
        const authOpts: apigw.MethodOptions = {
            authorizationType: apigw.AuthorizationType.COGNITO,
            authorizer
        }
        tickets.addMethod('GET', lambdaIntegration, authOpts)
        tickets.addMethod('POST', lambdaIntegration, authOpts)

        const ticketById = tickets.addResource('{id}')
        ticketById.addMethod('GET', lambdaIntegration, authOpts)

        const customDomain = new apigw.DomainName(this, 'CustomDomain', {
            domainName,
            certificate,
            endpointType: apigw.EndpointType.REGIONAL,
            securityPolicy: apigw.SecurityPolicy.TLS_1_2
        })
        customDomain.addBasePathMapping(this.api)

        new wafv2.CfnWebACLAssociation(this, 'ApiWafAssociation', {
            webAclArn: props.regionalWebAclArn,
            resourceArn: `arn:aws:apigateway:${this.region}::/restapis/${this.api.restApiId}/stages/${this.api.deploymentStage.stageName}`
        })

        new route53.ARecord(this, 'ApiGatewaySwiftSupport', {
            zone: hostedZone,
            recordName: subdomain,
            target: route53.RecordTarget.fromAlias(new targets.ApiGatewayDomain(customDomain))
        })

        new cdk.CfnOutput(this, 'ApiUrl', { value: this.apiUrl })
        new cdk.CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId })
        new cdk.CfnOutput(this, 'UserPoolClientId', { value: this.userPoolClient.userPoolClientId })
        new cdk.CfnOutput(this, 'CognitoDomain', { value: this.userPoolDomain.domainName })
    }
}
