import { ToolDefinition } from "src/libs/llm";

export const BUILT_IN_TOOLS: ToolDefinition[] = [
    {
        name: 'bank_name_list',
        description: `Provides a list of supported bank names for ATM searches.
This tool can be used to inform users about which banks they can filter by when searching for nearby ATMs.

Example Usage:
- User says want to see all bank names
- Do not use otherwise

Response:
Returns a list of bank names in the following structure:
{
  "banks": [
    "Bank A",
    "Bank B",
    "Bank C"
  ]
}`,
        parameters: {
            type: 'object',
            properties: {
                _placeholder: {
                    type: 'string',
                    description: 'Not used - this tool takes no parameters',
                },
            },
            required: [],
        },
    },
    {
        name: 'generate_qr_for_route_to_an_atm',
        description: `Generates a QR or routing payload to navigate to a selected ATM.

IMPORTANT: This tool must never be invoked directly from raw user input. The correct flow is:
1) Call \`get_nearest_atm\` first to obtain nearby ATM results (the *raw* \`nearestAtmResponse\`).
2) From the \`nearestAtmResponse\`, select an ATM (assistant or user selection).
3) Call \`generate_qr_for_route_to_an_atm\` with the following parameters (all required unless marked optional):
   - \`userLatitude\` (string) - user's latitude for routing
   - \`userLongitude\` (string) - user's longitude for routing
   - \`selectedAtmId\` (string) - id of the ATM chosen from \`nearestAtmResponse\`
   - \`selectedAtmLatitude\` (string) - latitude of the selected ATM
   - \`selectedAtmLongitude\` (string) - longitude of the selected ATM
   - \`bankName\` (string) - bank filter used when searching ATMs (required by schema)
   - \`requestId\` (string, optional) - idempotency / trace id from the client
Additionally, include the entire \`nearestAtmResponse\` (raw response from \`get_nearest_atm\`) in the payload so the backend can compute accurate routing/QR data.

The tool will return a QR or routing payload (structure is backend-defined). Do not call this tool without the \`nearestAtmResponse\` and the listed coordinates/ids.`,
        parameters: {
            type: 'object',
            properties: {
                userLatitude: {
                    type: 'string',
                    description: 'User latitude used for routing',
                },
                userLongitude: {
                    type: 'string',
                    description: 'User longitude used for routing',
                },
                selectedAtmId: {
                    type: 'string',
                    description: 'The id of the ATM selected from nearestAtmResponse',
                },
                selectedAtmLongitude: {
                    type: 'string',
                    description: 'Longitude of the selected ATM',
                },
                selectedAtmLatitude: {
                    type: 'string',
                    description: 'Latitude of the selected ATM',
                },
                bankName: {
                    type: 'string',
                    description: 'Optional bank filter used when searching ATMs',
                },
                requestId: {
                    type: 'string',
                    description: 'Optional idempotency / trace id from the client',
                },
            },
            required: ['userLongitude', 'userLatitude', 'selectedAtmLongitude', 'selectedAtmLatitude', 'selectedAtmId', 'bankName'],
        },
    },
    {
        name: 'get_nearest_atm',
        description: `Retrieves a list of nearby ATMs using the user's location (or provided coordinates).
Intended for user queries like "en yakın ATM" / "nearest ATM to me".

Request parameters:
- latitude (number): Latitude coordinate of the search location
- longitude (number): Longitude coordinate of the search location
- bankName (string, optional): Optional bank name to filter ATMs

Response:
Returns a list of nearby ATMs and user location in the following structure.

For each ATM item returned include: id, name, latitude, longitude, district, city, address,
status, depositStatus, withdrawStatus and supportedBanks. Also include the user's coordinates
(userLatitude, userLongitude) for proximity calculations on the client side.`,
        parameters: {
            type: 'object',
            properties: {
                latitude: {
                    type: 'string',
                    description: 'Latitude coordinate of the search location',
                },
                longitude: {
                    type: 'string',
                    description: 'Longitude coordinate of the search location',
                },
                bankName: {
                    type: 'string',
                    description: 'Optional bank name to filter ATMs',
                },
            },
            required: ['latitude', 'longitude', 'bankName'],
        },
    },
    {
        name: 'transaction_list',
        description: `Retrieves a user's transaction history for a specific account.

⚠️ IMPORTANT: accountId is REQUIRED. You CANNOT call this tool without an accountId.
Before calling this tool, you MUST:
1. First call \`get_user_accounts\` to retrieve the user's accounts
2. Show the accounts to the user and ASK which account they want to see transactions for
3. Only after the user selects an account, call this tool with that accountId

This function is used when the user asks to view their previous transactions, such as 
"show my last 5 transactions" or "list my income transactions for this month".

Parameters:
- accountId (string, REQUIRED): The account identifier for which transactions will be listed.
  You MUST obtain this from the user by first showing them their accounts.
- size (integer, default: 5): The number of transactions to return (max 5).
  If the user specifies a count (e.g., "last 3 transactions"), use that number.
- type (string, default: "ALL"): Filters transactions by type.
  Possible values: "EXPENSE" (money out), "INCOME" (money in), or "ALL" (no filtering).
- dateRange (string, default: "MONTH"): Filters transactions by date.
  Possible values: "WEEK", "MONTH", or "ALL" (no time filter).

Response:
Returns a paginated transaction list, including:
- transactions: List of TransactionDTO objects containing transaction details.
- totalElements: Total number of transactions available.
- totalPages: Total number of pages for pagination.

Example flow:
1. User: "Show my transactions"
2. Assistant: Calls get_user_accounts() → Shows accounts → "Which account would you like to see transactions for?"
3. User: "My TRY account"
4. Assistant: Calls transaction_list({ accountId: "...", size: 5 })`,
        parameters: {
            type: 'object',
            properties: {
                accountId: {
                    type: 'string',
                    description: 'The account ID whose transactions will be listed. REQUIRED - must be obtained from user selection.',
                },
                size: {
                    type: 'integer',
                    description: 'Number of transactions to return (max 5, default 5)',
                },
                type: {
                    type: 'string',
                    enum: ['EXPENSE', 'INCOME', 'ALL'],
                    description: 'Transaction type filter (default: ALL)',
                },
                dateRange: {
                    type: 'string',
                    enum: ['WEEK', 'MONTH', 'ALL'],
                    description: 'Date range filter (default: MONTH)',
                },
            },
            required: ['accountId'],
        },
    },
    {
        name: 'transfer_money',
        description: `⚠️ IMPORTANT SECURITY PROTOCOL (TWO-PHASE COMMIT):
This function MUST be called in two steps for security:
Step 1: VALIDATION (Dry Run)
  - First, call this with \`isConfirmed = false\`.
  - The system will check balances, validate the recipient name, and calculate fees.
  - You must then show the summary to the user and ASK for confirmation.

Step 2: EXECUTION (Final Commit)
  - ONLY after the user explicitly says "Yes" or "Confirm", call this function AGAIN.
  - Use the EXACT same parameters but set \`isConfirmed = true\`.

Initiates a money transfer from one account to another.

This function is triggered when the user wants to send money, 
such as "transfer 500 TL to Ahmet", "send $200 to IBAN TR12...", 
or "make a payment to my brother's account".

Parameters:
- fromIBAN (string, required): The IBAN of the sender's account (the source account).
- toIBAN (string, required): The recipient's IBAN (the destination account).
- amount (number, required): The amount of money to transfer.
- description (string, optional): Optional note or transfer explanation.
- toFirstName (string, optional): Receiver's first name.
- toSecondName (string, optional): Receiver's middle name, if any.
- toLastName (string, optional): Receiver's last name.
- isConfirmed (boolean, required): Set to false for initial validation/preview. Set to true ONLY when user confirms the preview.

Response:
Returns an immediate acknowledgment (BaseResponse) confirming that 
the transfer request has been received successfully. 
The actual transfer result (success/failure) is sent asynchronously via WebSocket notification.`,
        parameters: {
            type: 'object',
            properties: {
                fromIBAN: {
                    type: 'string',
                    description: "Sender's IBAN (source account)",
                },
                toIBAN: {
                    type: 'string',
                    description: "Recipient's IBAN (destination account)",
                },
                amount: {
                    type: 'number',
                    description: 'The amount of money to transfer',
                },
                description: {
                    type: 'string',
                    description: 'Optional note or transfer description',
                },
                toFirstName: {
                    type: 'string',
                    description: "Recipient's first name",
                },
                toSecondName: {
                    type: 'string',
                    description: "Recipient's middle name (if any)",
                },
                toLastName: {
                    type: 'string',
                    description: "Recipient's last name",
                },
                isConfirmed: {
                    type: 'boolean',
                    description: 'Set to false for initial validation/preview. Set to true ONLY when user confirms the preview.',
                },
            },
            required: ['fromIBAN', 'toIBAN', 'amount', 'isConfirmed'],
        },
    },
    {
        name: 'get_saved_accounts_for_transfer',
        description: `Use this function to retrieve saved recipient accounts specifically for money transfer purposes.
Retrieves a list of saved recipient accounts (saved recipients) specifically for money transfer purposes.
This function is used when the assistant needs to resolve a recipient mentioned by name or nickname (e.g., "Ali'ye 100 TL gönder",
"para gönder Ali", "send 50 to 'ev'") into an IBAN or saved recipient entry.

Request:
- query (string, optional): Free-text name or nickname to filter saved recipients.
- amount (number, required): The amount of money to transfer.

Response:
Returns an object containing:
- savedAccounts: List of SavedAccountDTO objects representing recipient entries:
  - id (string)
  - nickname (string)
  - accountIBAN (string)
  - firstName (string)
  - secondName (string)
  - lastName (string)

Example usage:
- When user says "Ali'ye 100 TL gönder", assistant may call get_saved_accounts({ "query": "Ali" }) to find matching saved recipients.`,
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Optional name or nickname to filter saved recipients',
                },
            },
            required: [],
        },
    },
    {
        name: 'get_saved_accounts',
        description: `Use this function to retrieve saved recipient accounts (saved recipients).
Retrieves a list of saved recipient accounts (saved recipients), not the user's own accounts.

Request:
- No required parameters: user identity is taken from request headers (e.g., X-User-Id).

Response:
Returns an object containing:
- savedAccounts: List of SavedAccountDTO objects representing recipient entries:
  - id (string)
  - nickname (string)
  - accountIBAN (string)
  - firstName (string)
  - secondName (string)
  - lastName (string)
  
Example usage:
- When user says "Kayıtlı alıcılarımı göster", assistant calls get_saved_accounts({}) to list all saved recipients.`,
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Optional name or nickname to filter saved recipients',
                },
            },
            required: [],
        },
    },
    {
        name: 'get_user_accounts',
        description: `Retrieves the list of accounts belonging to the authenticated user.

This function is triggered when the user requests to see their account information,
such as "show my accounts", "list all my bank accounts", or "display my balances".

If you have accountId or fromIBAN you does not need to call this function.

The request does not require explicit parameters because user identity is
automatically resolved from headers by the request interceptor.

Response:
Returns a list of account objects with balance, currency, and owner name information.

Response fields:
- accounts: A list of AccountDTO objects containing:
  - id (string): The unique account ID.
  - iban (string): The International Bank Account Number.
  - name (string): The account name or description.
  - balance (number): The current available balance.
  - currency (string): The account currency (e.g., TRY, USD, EUR).
- firstName (string): Account owner's first name.
- secondName (string, optional): Account owner's middle name, if available.
- lastName (string): Account owner's last name.

Example usage:
User says:
- "Show all my accounts"
- "List my TRY and USD accounts"
- "What's the balance in my main account?"
→ function: get_user_accounts()`,
        parameters: {
            type: 'object',
            properties: {
                _placeholder: {
                    type: 'string',
                    description: 'Not used - this tool takes no parameters',
                },
            },
            required: [],
        },
    },
    {
        name: 'get_account_detail',
        description: `Retrieves detailed information for a specific account by its ID.

This function is used when the user requests to view details of a single account,
such as "show details of my main account", "display my TRY account balance",
or "show information for account ending with 1234".

Parameters:
- accountId (string, required): The unique identifier of the account 
  whose details will be retrieved. 
  If not provided, the system should ask the user to select or specify
  which account they mean.

Response:
Returns detailed information about the specified account.

Response fields:
- account: An AccountDTO object containing:
  - id (string): The unique account ID.
  - iban (string): The account's IBAN.
  - name (string): The account name or description.
  - balance (number): The current available balance.
  - currency (string): The account currency (e.g., TRY, USD, EUR).

Example usage:
User says:
- "Show details of my savings account"
- "What's the balance in my TRY account?"
- "Display the IBAN of account 1"
→ function: get_account_detail({ "accountId": "..." })`,
        parameters: {
            type: 'object',
            properties: {
                accountId: {
                    type: 'string',
                    description: 'The account ID for which detailed information is requested',
                },
            },
            required: ['accountId'],
        },
    },
    {
        name: 'analyze_transactions',
        description: `Initiates transaction analysis for the user's account activity.

This function is used when the user wants to analyze their transaction patterns,
spending habits, or request a comprehensive transaction report,
such as "analyze my transactions from the last week", "give me a spending analysis",
or "generate a transaction report for the last 30 days".

The analysis process is asynchronous. This function will return an invoice/request ID
and an estimated completion date when the analysis will be ready for review.

Parameters:
- analyzeRange (string, required): The time period to analyze.
  Possible values:
  - "LAST_7_DAYS": Analyze transactions from the last 7 days
  - "LAST_30_DAYS": Analyze transactions from the last 30 days

Response:
Returns an analysis request confirmation with the following fields:
- invoiceRequestId (string): Unique identifier for tracking the analysis request.
- invoiceStatus (string): Current status of the analysis request.
- estimatedCompletionDate (datetime): When the analysis will be ready for review.
  Tell the user this date so they know when to expect the results.
- invoiceMessage (string): Additional message about the analysis request.

Example usage:
User says:
- "Analyze my transactions for the last week"
- "Generate a spending report for the last 30 days"
- "Give me an analysis of my recent transactions"
→ function: analyze_transactions({ "analyzeRange": "LAST_7_DAYS" })
→ function: analyze_transactions({ "analyzeRange": "LAST_30_DAYS" })`,
        parameters: {
            type: 'object',
            properties: {
                analyzeRange: {
                    type: 'string',
                    enum: ['LAST_7_DAYS', 'LAST_30_DAYS'],
                    description: 'The time period to analyze: LAST_7_DAYS or LAST_30_DAYS',
                },
            },
            required: ['analyzeRange'],
        },
    },
];
