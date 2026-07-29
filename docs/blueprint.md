# Trading Signal Executor Bot — Bot specification

**Archetype:** custom

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

Monitors owner-configured Telegram channels for trading signals, parses symbol/side/price/SL/TP/size, auto-executes trades on MetaTrader (Demo by default), tracks channel performance for conflict resolution, and notifies owner in private chat with execution confirmations and alerts.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- single owner
- trading signal subscriber

## Success criteria

- Accurately parse and execute 95%+ of valid signals without owner intervention
- Notify owner within 5 seconds of signal detection
- Maintain channel accuracy scores with 100% update reliability

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open main menu with channel management and account settings
- **Add channel** (button, actor: user, callback: channel:add) — Configure new signal channel to monitor
  - inputs: channel username, priority weight
  - outputs: channel ID in database
- **View performance** (button, actor: user, callback: performance:view) — Show channel accuracy scores and trade history
  - inputs: none
  - outputs: formatted performance table
- **Check open trades** (button, actor: user, callback: trades:open) — List current active trades with status
  - inputs: none
  - outputs: trade summary with SL/TP status
- **Switch to Live account** (button, actor: user, callback: account:switch) — Toggle between Demo and Live trading
  - inputs: confirmation prompt
  - outputs: account type update

## Flows

### Signal ingestion and parsing
_Trigger:_ New message in monitored channel

1. Detect message in configured channel
2. Apply pattern matching for symbol/side/price fields
3. Validate required fields (symbol, side, entry/limit/market)
4. Calculate lot size if missing (1% of available balance)

_Data touched:_ Signal, Channel

### Conflict resolution
_Trigger:_ Multiple signals for same symbol

1. Compare channel priority scores
2. Select highest-priority valid signal
3. Request owner approval if scores are equal

_Data touched:_ Channel, Signal

### Trade execution
_Trigger:_ Approved signal with complete parameters

1. Calculate position size based on risk percent
2. Select order type (market/limit)
3. Place order on current account (Demo by default)
4. Send execution confirmation to owner

_Data touched:_ Trade, Account

### Performance tracking
_Trigger:_ Trade fill or closure

1. Record trade outcome
2. Update channel accuracy score
3. Recalculate channel priority rankings

_Data touched:_ Performance log, Channel

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **Channel** _(retention: persistent)_ — Monitored signal source with performance tracking
  - fields: username, priority_score, accuracy_history, last_scanned
- **Signal** _(retention: persistent)_ — Parsed trading instruction from channel message
  - fields: raw_text, symbol, side, entry_price, stop_loss, take_profit, lots, timestamp
- **Trade** _(retention: persistent)_ — Execution record and outcome tracking
  - fields: order_type, symbol, lots, entry_price, sl, tp, account_type, status, fill_price
- **Account** _(retention: persistent)_ — MetaTrader account configuration and balance
  - fields: account_type, available_balance, last_used
- **Performance log** _(retention: persistent)_ — Channel accuracy tracking for conflict resolution
  - fields: channel_id, trade_id, outcome, timestamp

## Integrations

- **MetaTrader** (required) — Order placement and trade execution
- **Telegram** (required) — Bot API messaging
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Add/remove monitored channels
- Adjust default risk percent (1% default)
- Switch between Demo/Live accounts
- Approve conflicting signals manually

## Notifications

- Execution confirmation with trade details
- Error alerts for rejected orders
- Channel performance updates
- Approval prompts for conflicting signals

## Permissions & privacy

- All trade data stored encrypted
- Channel messages parsed anonymously
- Owner chat ID used only for alerts

## Edge cases

- Conflicting signals from multiple channels
- Missing required signal parameters
- MetaTrader API connection failures
- Channel ownership changes

## Required tests

- End-to-end signal parsing and execution flow
- Conflict resolution with equal-priority channels
- Demo/Live account switching
- Error handling for incomplete signals

## Assumptions

- Default to Demo account until explicitly switched
- 1% risk sizing when lots unspecified
- Channel priority determined by accuracy score
- Owner prefers market orders for immediate execution
