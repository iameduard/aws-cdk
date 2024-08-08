import { SQS } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

export const handler = async (event: any) => {
    const sqs = new SQS();

    const body = JSON.parse(event.body || '{}');
    const message = event;

    const messageGroupId = 'default';
    const messageDeduplicationId = uuidv4();

    const queueUrl = process.env.SQS_QUEUE_URL!;

    const messageAttributes = {
        versionEvento: {
            StringValue: '1.0',
            DataType: 'String'
        },
        origen: {
            StringValue: 'Informes',
            DataType: 'String'
        },
        fechaEvento: {
            StringValue: new Date().toISOString(),
            DataType: 'String'
        },
        tipoEvento: {
            StringValue: 'Notificación',
            DataType: 'String'
        },
        usuario: {
            StringValue: body.usuario || 'Unknown',
            DataType: 'String'
        }
    };

    // Enviar el mensaje a SQS
    try {
        const response = await sqs.sendMessage({
            QueueUrl: queueUrl,
            MessageBody: JSON.stringify(body),
            MessageGroupId: messageGroupId,
            MessageDeduplicationId: messageDeduplicationId,
            MessageAttributes: messageAttributes
        }).promise();

        //console.log(response);

        return {
            statusCode: 200,
            body: JSON.stringify('Message sent to SQS!'),
            response: JSON.stringify(response)
        };
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to send message to SQS' })
        };
    }
};