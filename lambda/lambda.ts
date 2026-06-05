import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { randomUUID } from 'crypto'

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const bedrock = new BedrockRuntimeClient({});

const TABLE = process.env.TICKET_TABLE!;
const USER_INDEX = process.env.USER_INDEX!;
const MODEL_ID = process.env.BEDROCK_MODEL_ID!;

const json = (statusCode: number, body: unknown): APIGatewayProxyResult => ({
    statusCode,
    headers: {
        'content-type': 'application/json',
        'access-control-allow-origin': '*'
    },
    body: JSON.stringify(body)
});

const aiSummarize = async (message: string): Promise<string> => {
    const response = await bedrock.send(new InvokeModelCommand({
        modelId: MODEL_ID,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: 400,
            system: 'You are SwiftSupport, a friendly support triage assistant. Reply in 2-3 short sentences with a likely cause and one concrete next step.',
            messages: [{ role: 'user', content: message }]
        })
    }));
    const decoded = JSON.parse(Buffer.from(response.body).toString('utf-8'));
    return decoded?.content?.[0]?.text ?? 'AI summary unavailable.';
};

export const lambda = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const method = event.httpMethod;
        const claims = event.requestContext.authorizer?.claims ?? {};
        const userId: string | undefined = claims['sub'];
        const email: string | undefined = claims['email'];
        if (!userId) return json(401, { error: 'unauthenticated' });

        // POST /tickets — create
        if (method === 'POST') {
            const body = event.body ? JSON.parse(event.body) : {};
            const title = String(body.title ?? '').slice(0, 200);
            const description = String(body.description ?? '').slice(0, 4000);
            const category = String(body.category ?? 'other').slice(0, 40);
            const priority = String(body.priority ?? 'medium').slice(0, 20);
            if (!title || !description) return json(400, { error: 'title and description required' });

            const id = `TKT-${randomUUID().slice(0, 8).toUpperCase()}`;
            const createdAt = new Date().toISOString();
            const aiResponse = await aiSummarize(`${title}\n\n${description}`);

            const item = {
                id, createdAt, userId, email,
                title, description, category, priority,
                status: 'open',
                aiResponse
            };
            await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
            return json(201, item);
        }

        // GET /tickets — list for current user
        if (method === 'GET' && !event.pathParameters?.id) {
            const result = await ddb.send(new QueryCommand({
                TableName: TABLE,
                IndexName: USER_INDEX,
                KeyConditionExpression: 'userId = :u',
                ExpressionAttributeValues: { ':u': userId },
                ScanIndexForward: false,
                Limit: 50
            }));
            return json(200, { items: result.Items ?? [] });
        }

        // GET /tickets/{id}
        if (method === 'GET' && event.pathParameters?.id) {
            const id = event.pathParameters.id;
            const result = await ddb.send(new GetCommand({ TableName: TABLE, Key: { id } }));
            if (!result.Item || result.Item.userId !== userId) return json(404, { error: 'not found' });
            return json(200, result.Item);
        }

        return json(405, { error: 'method not allowed' });
    } catch (err) {
        console.error('handler error', err);
        return json(500, { error: 'internal error' });
    }
};
