import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as apigw from 'aws-cdk-lib/aws-apigateway'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as route53 from 'aws-cdk-lib/aws-route53'
import * as targets from 'aws-cdk-lib/aws-route53-targets'

export class SwiftSupportDomainAPI extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props)

        const domainName = 'api.swiftsupport.com'
        const zoneName = 'swiftsupport.com'

        const hostedZone = route53.HostedZone.fromLookup(this, 'Zone', { domainName: zoneName })

        const certificate = new acm.Certificate(this, 'ApiCertificate', {
            domainName: domainName,
            validation: acm.CertificateValidation.fromDns(hostedZone)
        })

        const api = new apigw.RestApi(this, 'SwiftSupportApigw', {
            restApiName: 'My Service',
            description: 'My service Device'
        })

        const customDomain = new apigw.DomainName(this, 'CustomDomain', {
            domainName: domainName,
            certificate: certificate,
            endpointType: apigw.EndpointType.REGIONAL,
            securityPolicy: apigw.SecurityPolicy.TLS_1_2
        })

        customDomain.addBasePathMapping(api)

        api.root.addMethod('GET', new apigw.MockIntegration({
            integrationResponses: [{ statusCode: '200' }],
            requestTemplates: { 'application/json': '{"statusCode": 200}' }
        }), {
            methodResponses: [{ statusCode: '200' }]
        })

        new route53.ARecord(this, 'ApiGatewaySwiftSupport', {
            zone: hostedZone,
            recordName: 'api',
            target: route53.RecordTarget.fromAlias(new targets.ApiGateway(api))
        })

        new cdk.CfnOutput(this, 'ApiUrl', {
            value: `https://${domainName}`
        })
    }
}