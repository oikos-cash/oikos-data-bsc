'use strict';

const ws = require('ws');
const { SubscriptionClient } = require('subscriptions-transport-ws');

const pageResults = require('graph-results-pager');

const graphAPIEndpoints = {
	oks: 'https://api.thegraph.com/subgraphs/name/oikos-cash/oikos',
	depot: 'https://api.thegraph.com/subgraphs/name/synthetixio-team/synthetix-depot',
	exchanges: 'https://api.thegraph.com/subgraphs/name/oikos-cash/exchanges',
	rates: 'https://api.thegraph.com/subgraphs/name/oikos-cash/rates',
};

const graphWSEndpoints = {
	exchanges: 'wss://api.thegraph.com/subgraphs/name/oikos-cash/exchanges',
	rates: 'wss://api.thegraph.com/subgraphs/name/oikos-cash/rates',
};

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const hexToAscii = str => {
	const hex = str.toString();
	let out = '';
	for (let n = 2; n < hex.length; n += 2) {
		const nextPair = hex.substr(n, 2);
		if (nextPair !== '00') {
			out += String.fromCharCode(parseInt(nextPair, 16));
		}
	}
	return out;
};

module.exports = {
	pageResults,
	graphAPIEndpoints,
	depot: {
		userActions({ network = 'mainnet', user = undefined, max = 100 }) {
			return pageResults({
				api: graphAPIEndpoints.depot,
				query: {
					entity: 'userActions',
					selection: {
						orderBy: 'timestamp',
						orderDirection: 'desc',
						where: {
							network: `\\"${network}\\"`,
							user: user ? `\\"${user}\\"` : undefined,
						},
					},
					properties: ['id', 'user', 'amount', 'minimum', 'depositIndex', 'type', 'block', 'timestamp'],
				},
				max,
			})
				.then(results =>
					results.map(({ id, user, amount, type, minimum, depositIndex, block, timestamp }) => ({
						hash: id.split('-')[0],
						user,
						amount: amount / 1e18,
						type,
						minimum: minimum !== null ? Number(minimum) : null,
						depositIndex: depositIndex !== null ? Number(depositIndex) : null,
						block: Number(block),
						timestamp: Number(timestamp * 1000),
						date: new Date(timestamp * 1000),
					})),
				)
				.catch(err => console.error(err));
		},
		clearedDeposits({ network = 'mainnet', fromAddress = undefined, toAddress = undefined, max = 100 }) {
			return pageResults({
				api: graphAPIEndpoints.depot,
				query: {
					entity: 'clearedDeposits',
					selection: {
						orderBy: 'timestamp',
						orderDirection: 'desc',
						where: {
							network: `\\"${network}\\"`,
							fromAddress: fromAddress ? `\\"${fromAddress}\\"` : undefined,
							toAddress: toAddress ? `\\"${toAddress}\\"` : undefined,
						},
					},
					properties: [
						'id',
						'fromAddress',
						'toAddress',
						'fromETHAmount',
						'toAmount',
						'depositIndex',
						'block',
						'timestamp',
					],
				},
				max,
			})
				.then(results =>
					results.map(({ id, fromAddress, toAddress, fromETHAmount, toAmount, depositIndex, block, timestamp }) => ({
						hash: id.split('-')[0],
						fromAddress,
						toAddress,
						fromETHAmount: fromETHAmount / 1e18,
						toAmount: toAmount / 1e18,
						depositIndex: depositIndex !== null ? Number(depositIndex) : null,
						block: Number(block),
						timestamp: Number(timestamp * 1000),
						date: new Date(timestamp * 1000),
					})),
				)
				.catch(err => console.error(err));
		},
	},
	exchanges: {
		_properties: [
			'id',
			'from',
			'gasPrice',
			'from',
			'fromAmount',
			'fromAmountInUSD',
			'fromCurrencyKey',
			'toCurrencyKey',
			'toAddress',
			'toAmount',
			'toAmountInUSD',
			'feesInUSD',
			'block',
			'timestamp',
		],
		_mapSynthExchange: ({
			gasPrice,
			timestamp,
			id,
			from,
			fromAmount,
			block,
			fromAmountInUSD,
			fromCurrencyKey,
			toAddress,
			toAmount,
			toAmountInUSD,
			toCurrencyKey,
			feesInUSD,
		}) => ({
			gasPrice: gasPrice / 1e9,
			block: Number(block),
			timestamp: Number(timestamp * 1000),
			date: new Date(timestamp * 1000),
			hash: id.split('-')[0],
			fromAddress: from,
			fromAmount: fromAmount / 1e18, // shorthand way to convert wei into BNB
			fromCurrencyKeyBytes: fromCurrencyKey,
			fromCurrencyKey: hexToAscii(fromCurrencyKey),
			fromAmountInUSD: fromAmountInUSD / 1e18,
			toAmount: toAmount / 1e18,
			toAmountInUSD: toAmountInUSD / 1e18,
			toCurrencyKeyBytes: toCurrencyKey,
			toCurrencyKey: hexToAscii(toCurrencyKey),
			toAddress,
			feesInUSD: feesInUSD / 1e18,
		}),

		/**
		 * Get the exchange totals for the given network.
		 */
		total({ network = 'mainnet' } = {}) {
			return pageResults({
				api: graphAPIEndpoints.exchanges,
				query: {
					entity: 'totals',
					/*selection: {
						where: {
							id: `\\"${network}\\"`,
						},
					},*/
					properties: ['trades', 'exchangers', 'exchangeUSDTally', 'totalFeesGeneratedInUSD'],
				},
				max: 1,
			})
				.then(([{ trades, exchangers, exchangeUSDTally, totalFeesGeneratedInUSD }]) => ({
					trades: trades,
					exchangers: exchangers,
					exchangeUSDTally: exchangeUSDTally / 1e18,
					totalFeesGeneratedInUSD: totalFeesGeneratedInUSD / 1e18,
				}))
				.catch(err => console.error(err));
		},
		/**
		 * Get all exchanges since some timestamp in seconds or minimum block (ordered reverse chronological)
		 */
		since({
			network = 'mainnet',
			max = Infinity,
			minTimestamp = undefined,
			maxTimestamp = undefined,
			minBlock = undefined,
			maxBlock = undefined,
			fromAddress = undefined,
		} = {}) {
			return pageResults({
				api: graphAPIEndpoints.exchanges,
				max,
				query: {
					entity: 'synthExchanges',
					selection: {
						orderBy: 'timestamp',
						orderDirection: 'desc',
						where: {
							network: `\\"${network}\\"`,
							timestamp_gte: minTimestamp || undefined,
							timestamp_lte: maxTimestamp || undefined,
							block_gte: minBlock || undefined,
							block_lte: maxBlock || undefined,
							from: fromAddress ? `\\"${fromAddress}\\"` : undefined,
						},
					},
					properties: module.exports.exchanges._properties,
				},
			})
				.then(results => results.map(module.exports.exchanges._mapSynthExchange))
				.catch(err => console.error(err));
		},

		_rebateOrReclaim({ isReclaim }) {
			return ({
				account = undefined,
				max = Infinity,
				minTimestamp = undefined,
				maxTimestamp = undefined,
				minBlock = undefined,
				maxBlock = undefined,
			} = {}) => {
				return pageResults({
					api: graphAPIEndpoints.exchanges,
					max,
					query: {
						entity: `exchange${isReclaim ? 'Reclaim' : 'Rebate'}s`,
						selection: {
							orderBy: 'timestamp',
							orderDirection: 'desc',
							where: {
								timestamp_gte: minTimestamp || undefined,
								timestamp_lte: maxTimestamp || undefined,
								block_gte: minBlock || undefined,
								block_lte: maxBlock || undefined,
								account: account ? `\\"${account}\\"` : undefined,
							},
						},
						properties: ['id', 'amount', 'amountInUSD', 'currencyKey', 'account', 'timestamp', 'block', 'gasPrice'],
					},
				})
					.then(results =>
						results.map(({ gasPrice, timestamp, id, account, block, currencyKey, amount, amountInUSD }) => ({
							gasPrice: gasPrice / 1e9,
							block: Number(block),
							timestamp: Number(timestamp * 1000),
							date: new Date(timestamp * 1000),
							hash: id.split('-')[0],
							account,
							amount: amount / 1e18, // shorthand way to convert wei into BNB,
							amountInUSD: amountInUSD / 1e18,
							currencyKey: hexToAscii(currencyKey),
							currencyKeyBytes: currencyKey,
						})),
					)
					.catch(err => console.error(err));
			};
		},

		reclaims(args) {
			return this._rebateOrReclaim({ isReclaim: true })(args);
		},

		rebates(args) {
			return this._rebateOrReclaim({ isReclaim: false })(args);
		},

		observe() {
			const client = new SubscriptionClient(
				graphWSEndpoints.exchanges,
				{
					reconnect: true,
				},
				ws,
			);

			const observable = client.request({
				query: `subscription { synthExchanges(first: 1, orderBy: timestamp, orderDirection: desc) { ${module.exports.exchanges._properties.join(
					',',
				)}  } }`,
			});

			return {
				// return an observable object that transforms the results before yielding them
				subscribe({ next, error, complete }) {
					return observable.subscribe({
						next({ data: { synthExchanges } }) {
							synthExchanges.map(module.exports.exchanges._mapSynthExchange).forEach(next);
						},
						error,
						complete,
					});
				},
			};
		},
	},
	synths: {
		issuers({ max = 10 } = {}) {
			return pageResults({
				api: graphAPIEndpoints.oks,
				max,
				query: {
					entity: 'issuers',
					properties: ['id'],
				},
			})
				.then(results => results.map(({ id }) => id))
				.catch(err => console.error(err));
		},
		/**
		 * Get the latest synth transfers
		 */
		transfers({
			synth = undefined,
			from = undefined,
			to = undefined,
			max = 100,
			minBlock = undefined,
			maxBlock = undefined,
		} = {}) {
			return pageResults({
				api: graphAPIEndpoints.oks,
				max,
				query: {
					entity: 'transfers',
					selection: {
						orderBy: 'timestamp',
						orderDirection: 'desc',
						where: {
							source: synth ? `\\"${synth}\\"` : undefined,
							source_not: '\\"oks\\"',
							from: from ? `\\"${from}\\"` : undefined,
							to: to ? `\\"${to}\\"` : undefined,
							from_not: `\\"${ZERO_ADDRESS}\\"`, // Ignore Issue events
							to_not: `\\"${ZERO_ADDRESS}\\"`, // Ignore Burn events
							block_gte: minBlock || undefined,
							block_lte: maxBlock || undefined,
						},
					},
					properties: ['id', 'source', 'to', 'from', 'value', 'block', 'timestamp'],
				},
			})
				.then(results =>
					results.map(({ id, source, block, timestamp, from, to, value }) => ({
						source,
						block: Number(block),
						timestamp: Number(timestamp * 1000),
						date: new Date(timestamp * 1000),
						hash: id.split('-')[0],
						from,
						to,
						value: value / 1e18,
					})),
				)
				.catch(err => console.error(err));
		},
	},
	rate: {
		/**
		 * Get the last max RateUpdate events for the given synth in reverse order
		 */
		updates({
			synth,
			minBlock = undefined,
			maxBlock = undefined,
			minTimestamp = undefined,
			maxTimestamp = undefined,
			max = 100,
		} = {}) {
			return pageResults({
				api: graphAPIEndpoints.rates,
				max,
				query: {
					entity: 'rateUpdates',
					selection: {
						orderBy: 'timestamp',
						orderDirection: 'desc',
						where: {
							synth: synth ? `\\"${synth}\\"` : undefined,
							synth_not_in: !synth
								? '[' + ['oks', 'BNB', 'ODR'].map(code => `\\"${code}\\"`).join(',') + ']'
								: undefined, // ignore non-synth prices
							block_gte: minBlock || undefined,
							block_lte: maxBlock || undefined,
							timestamp_gte: minTimestamp || undefined,
							timestamp_lte: maxTimestamp || undefined,
						},
					},
					properties: ['id', 'synth', 'rate', 'block', 'timestamp'],
				},
			})
				.then(results => {
					console.log(results)
					results.map(({ id, rate, block, timestamp, synth }, idx) => ({
						
						block: Number(block),
						synth,
						timestamp: Number(timestamp * 1000),
						date: new Date(timestamp * 1000),
						hash: id.split('-')[0],
						rate: rate / 1e18,
					}))
				}

				)
				 
				.catch(err => console.error(err));
		},
		observe({ minTimestamp = Math.round(Date.now() / 1000) } = {}) {
			const client = new SubscriptionClient(
				graphWSEndpoints.rates,
				{
					reconnect: true,
				},
				ws,
			);

			// Note: we can't use "first" here as some updates come together (the oks oracle groups together some rates)
			const observable = client.request({
				query: `subscription { rateUpdates(where: { timestamp_gt: ${minTimestamp}}, orderBy: timestamp, orderDirection: desc) { ${[
					'id',
					'synth',
					'rate',
					'block',
					'timestamp',
				].join(',')}  } }`,
			});

			return {
				// return an observable object that transforms the results before yielding them
				subscribe({ next, error, complete }) {
					return observable.subscribe({
						next({ data: { rateUpdates } }) {
							rateUpdates.forEach(next);
						},
						error,
						complete,
					});
				},
			};
		},
	},
	oks: {
		holders({ max = 100 } = {}) {
			return pageResults({
				api: graphAPIEndpoints.oks,
				max,
				query: {
					entity: 'oksholders',
					selection: {
						orderBy: 'collateral',
						orderDirection: 'desc',
					},
					properties: [
						'id', // the address of the holder
						'block', // the block this entity was last updated in
						'timestamp', // the timestamp when this entity was last updated
						'collateral', // Synthetix.collateral (all collateral the account has, including escrowed )
						'balanceOf', // oks balance in their wallet
						'transferable', // All non-locked oks
						'initialDebtOwnership', // Debt data from SynthetixState, used to calculate debtBalance
						'debtEntryAtIndex', // Debt data from SynthetixState, used to calculate debtBalance
					],
				},
			})
				.then(results =>
					results.map(
						({
							id,
							collateral,
							block,
							timestamp,
							balanceOf,
							transferable,
							initialDebtOwnership,
							debtEntryAtIndex,
						}) => ({
							address: id,
							block: Number(block),
							timestamp: Number(timestamp * 1000),
							date: new Date(timestamp * 1000),
							collateral: collateral ? collateral / 1e18 : null,
							balanceOf: balanceOf ? balanceOf / 1e18 : null,
							transferable: transferable ? transferable / 1e18 : null,
							initialDebtOwnership: initialDebtOwnership ? initialDebtOwnership / 1e18 : null,
							debtEntryAtIndex: debtEntryAtIndex ? debtEntryAtIndex / 1e18 : null,
						}),
					),
				)
				.catch(err => console.error(err));
		},

		rewards({ max = 100 } = {}) {
			return pageResults({
				api: graphAPIEndpoints.oks,
				max,
				query: {
					entity: 'rewardEscrowHolders',
					selection: {
						orderBy: 'balanceOf',
						orderDirection: 'desc',
					},
					properties: ['id', 'balanceOf'],
				},
			})
				.then(results =>
					results.map(({ id, balanceOf }) => ({
						address: id,
						balance: balanceOf / 1e18,
					})),
				)
				.catch(err => console.error(err));
		},
		/**
		 * Get the exchange totals for the given network.
		 */
		total() {
			return pageResults({
				api: graphAPIEndpoints.oks,
				query: {
					entity: 'oikoses',
					selection: {
						where: {
							id: 1,
						},
					},
					properties: ['issuers', 'oksHolders'],
				},
				max: 1,
			})
				.then(([{ issuers, oksHolders }]) => ({
					issuers: Number(issuers),
					oksHolders: Number(oksHolders),
				}))
				.catch(err => console.error(err));
		},
		/**
		 * Get the latest oks transfers
		 */
		transfers({ from = undefined, to = undefined, max = 100, minBlock = undefined, maxBlock = undefined } = {}) {
			return pageResults({
				api: graphAPIEndpoints.oks,
				max,
				query: {
					entity: 'transfers',
					selection: {
						orderBy: 'timestamp',
						orderDirection: 'desc',
						where: {
							source: '\\"oks\\"',
							from: from ? `\\"${from}\\"` : undefined,
							to: to ? `\\"${to}\\"` : undefined,
							block_gte: minBlock || undefined,
							block_lte: maxBlock || undefined,
						},
					},
					properties: ['id', 'to', 'from', 'value', 'block', 'timestamp'],
				},
			})
				.then(results =>
					results.map(({ id, block, timestamp, from, to, value }) => ({
						block: Number(block),
						timestamp: Number(timestamp * 1000),
						date: new Date(timestamp * 1000),
						hash: id.split('-')[0],
						from,
						to,
						value: value / 1e18,
					})),
				)
				.catch(err => console.error(err));
		},
	},
};
