// amplify/functions/sendStockEmail/handler.ts
import { SESClient, SendEmailCommand, SendEmailCommandInput } from "@aws-sdk/client-ses";

// Define structure for each item in the input array
interface PortfolioItem {
  symbol: string;
  price: number | null;
  name?: string | null; // Optional stock name
}

// Update expected arguments
interface SendPortfolioEmailEventArgs {
  portfolioSummary: PortfolioItem[];
}

// Update the event interface
interface AppSyncEvent {
  arguments: SendPortfolioEmailEventArgs;
  identity: {
    claims?: { email?: string; };
  };
}

const senderEmail = process.env.SENDER_EMAIL_ADDRESS!;
const sesRegion = process.env.SES_REGION!;
const sesClient = new SESClient({ region: sesRegion });

export const handler = async (event: AppSyncEvent): Promise<boolean> => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  const portfolioSummary = event.arguments.portfolioSummary;
  const recipientEmail = event.identity?.claims?.email;

  if (!recipientEmail) { /* ... handle missing recipient ... */ return false; }
  if (!senderEmail) { /* ... handle missing sender ... */ return false; }
  if (!portfolioSummary || portfolioSummary.length === 0) {
     console.log("No portfolio summary data provided.");
     return false; // Or true if sending an empty email is desired?
  }

  console.log(`Attempting to send portfolio summary to ${recipientEmail}`);

  // --- Generate Email Body ---
  const subject = `Your Portfolio Summary`;
  let bodyText = "Here is your portfolio summary with the latest fetched prices:\n\n";
  // Optional: Add HTML version too
  // let bodyHtml = "<h2>Portfolio Summary</h2><table border='1'><tr><th>Symbol</th><th>Name</th><th>Price</th></tr>";

  portfolioSummary.forEach(item => {
    const priceString = typeof item.price === 'number' ? `$${item.price.toFixed(2)}` : 'N/A';
    const nameString = item.name || '---'; // Handle potentially null names
    bodyText += `<span class="math-inline">\{item\.symbol\} \(</span>{nameString}): ${priceString}\n`;
    // bodyHtml += `<tr><td><span class="math-inline">\{item\.symbol\}</td\><td\></span>{nameString}</td><td>${priceString}</td></tr>`;
  });
  // bodyHtml += "</table>";
  // --- End Email Body Generation ---

  const params: SendEmailCommandInput = {
    Source: senderEmail,
    Destination: { ToAddresses: [recipientEmail] },
    Message: {
      Subject: { Data: subject },
      Body: {
        Text: { Data: bodyText },
        // Html: { Data: bodyHtml }, // Uncomment to send HTML version
      },
    },
  };

  try {
    console.log("Sending portfolio email...");
    await sesClient.send(new SendEmailCommand(params));
    console.log(`Portfolio email sent successfully to ${recipientEmail}`);
    return true;
  } catch (error: any) {
    console.error(`Error sending portfolio email via SES:`, error.message || error);
    return false;
  }
};