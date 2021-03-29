# oikos-data

[![Twitter Follow](https://img.shields.io/twitter/follow/oikos_cash.svg?label=oikos&style=social)](https://twitter.com/oikos_cash)

This is a collection of utilities to query Oikos data from Ethereum. This data has been indexed by The Graph via the various subgraphs the oikos team maintains ([the subgraph code repo](https://github.com/oikos-cash/oikos-subgraph)).

## Supported queries

The below all return a Promise that resolves with the requested results.

1. `depot.userActions({ user })` Get all depot deposit (`sUSD`) actions for the given user - `deposit`, `withdrawl`, `unaccepted`, `removed`.
2. `depot.clearedDeposits({ fromAddress, toAddress })` Get all cleared synth deposits (payments of `BNB` for `sUSD`) either from a given `fromAddress` or (and as well as) to a given `toAddress`
3. `exchanges.total()` Get the total exchange volume, total fees and total number of unique exchange addresses.
4. `exchanges.rebates({ minTimestamp = 1 day ago })` Get the last `N` exchange rebates since the given `minTimestamp` in seconds. Ordered in reverse chronological order.
5. `exchanges.reclaims({ minTimestamp = 1 day ago })` Get the last `N` exchange reclaims since the given `minTimestamp` in seconds. Ordered in reverse chronological order.
6. `exchanges.since({ minTimestamp = 1 day ago })` Get the last `N` exchanges since the given `minTimestamp` (in seconds, so one hour ago is `3600`). These are ordered in reverse chronological order.
7. `rate.updates` Get all rate updates for synths in reverse chronological order
8. `synths.issuers` Get all wallets that have invoked `Issue` on `sUSD` (other synths to come)
9. `synths.transfers` Get synth transfers in reverse chronological order
10. `oks.holders` Get the list of wallets that have ever sent or received `oks`.
11. `oks.rewards` Get the list of reward escrow holders and their latest balance at vesting entry add or vest.
12. `oks.total` Get the total count of unique `issuers` and `oksHolders`
13. `oks.transfers` Get oks transfers in reverse chronological order

## Supported subscriptions

The below all return an [Observable](https://github.com/tc39/proposal-observable) that when subscribed to with an object.

1. `exchanges.observe()` Get an observable to `subscribe` to that will `next` the latest exchanges in real time (replays the most recent exchange immediately).
1. `rates.observe()` Get an observable to `subscribe` to that will `next` the latest rates in real time (replays the most recent exchange immediately).

## Use this as a node or webpack dependency

```javascript
const oksData = require('oikos-data'); // common js
// or
import oksData from 'oikos-data'; // es modules

// query and log resolved results
oksData.exchanges
	.since({
		minTimestamp: Math.floor(Date.now() / 1e3) - 3600 * 24, // one day ago
	})
	.then(exchanges => console.log(exchanges));

// subscribe and log streaming results
oksData.exchanges.observe().subscribe({
	next(val) {
		console.log(val);
	},
	error: console.error,
	complete() {
		console.log('done');
	},
});
```

### Use in a browser

```html
<script src="//cdn.jsdelivr.net/npm/oikos-data/browser.js"></script>
<script>
	window.oksData.exchanges
		.since({
			minTimestamp: Math.floor(Date.now() / 1e3) - 3600 * 24, // one day ago
		})
		.then(console.log);

	window.oksData.exchanges.observe().subscribe({ next: console.log });
</script>
```

## How to query via the npm library (CLI)

```bash
# get last 24 hours of exchange activity, ordered from latest to earliest
npx oikos-data exchanges.since

# get exchanges on oikos as they occur in real time (replays the last exchange first)
npx oikos-data exchanges.subscribe
```
