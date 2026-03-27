# Finn Future Direction

## Final Product Direction
Finn should become an always-on financial agent, not just an expense tracker. The app should feel like a calm control surface for something already working in the background.

## Next Major Capabilities
- Real ask-Finn conversational querying over personal transaction history, trends, merchants, and reports
- Proactive outreach through notifications and message-style summaries when Finn detects something worth saying
- Background report generation and scheduled monitoring jobs running continuously in the cloud
- UPI-aware ingestion beyond manual logging, including richer transaction context and cleaner merchant detection
- Better personalization so Finn understands habits, recurring payments, spending baselines, and anomalies per user
- More advanced reporting with budgets, savings signals, category goals, and longer-term monthly or quarterly narratives

## Product Evolution
- Move from a feed with generated messages to a true assistant experience with inbox, prompts, and memory
- Add stronger data modeling for accounts, payment methods, recurring subscriptions, and merchant normalization
- Expand from INR-first manual tracking to a more complete financial layer without losing the India-first focus
- Introduce a polished notification and retention loop so Finn reaches out at the right time with the right level of urgency

## Technical Direction
- Keep backend contracts structured so deterministic insights can later be upgraded to AI-generated summaries and answers
- Add job scheduling, idempotent report generation, and event-driven processing for expense changes
- Prepare for retrieval and query layers that let Finn answer user questions grounded in actual user data
- Preserve a clean shared type system between Expo, Hono, and Drizzle so product evolution stays predictable
