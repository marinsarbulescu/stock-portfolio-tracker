import { Schema } from "@aws-amplify/datastore";

export const schema: Schema = {
    "models": {
        "PortfolioStock": {
            "name": "PortfolioStock",
            "fields": {
                "id": {
                    "name": "id",
                    "isArray": false,
                    "type": "ID",
                    "isRequired": true,
                    "attributes": []
                },
                "symbol": {
                    "name": "symbol",
                    "isArray": false,
                    "type": "String",
                    "isRequired": true,
                    "attributes": []
                },
                "stockType": {
                    "name": "stockType",
                    "isArray": false,
                    "type": {
                        "enum": "StockType"
                    },
                    "isRequired": true,
                    "attributes": []
                },
                "region": {
                    "name": "region",
                    "isArray": false,
                    "type": {
                        "enum": "Region"
                    },
                    "isRequired": true,
                    "attributes": []
                },
                "stockTrend": {
                    "name": "stockTrend",
                    "isArray": false,
                    "type": {
                        "enum": "StockTrend"
                    },
                    "isRequired": false,
                    "attributes": []
                },
                "name": {
                    "name": "name",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "pdp": {
                    "name": "pdp",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "plr": {
                    "name": "plr",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "budget": {
                    "name": "budget",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "isHidden": {
                    "name": "isHidden",
                    "isArray": false,
                    "type": "Boolean",
                    "isRequired": false,
                    "attributes": []
                },
                "archived": {
                    "name": "archived",
                    "isArray": false,
                    "type": "Boolean",
                    "isRequired": false,
                    "attributes": []
                },
                "archivedAt": {
                    "name": "archivedAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": []
                },
                "swingHoldRatio": {
                    "name": "swingHoldRatio",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "stockCommission": {
                    "name": "stockCommission",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "htp": {
                    "name": "htp",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "transactions": {
                    "name": "transactions",
                    "isArray": true,
                    "type": {
                        "model": "Transaction"
                    },
                    "isRequired": false,
                    "attributes": [],
                    "isArrayNullable": true,
                    "association": {
                        "connectionType": "HAS_MANY",
                        "associatedWith": [
                            "portfolioStockId"
                        ]
                    }
                },
                "stockWallets": {
                    "name": "stockWallets",
                    "isArray": true,
                    "type": {
                        "model": "StockWallet"
                    },
                    "isRequired": false,
                    "attributes": [],
                    "isArrayNullable": true,
                    "association": {
                        "connectionType": "HAS_MANY",
                        "associatedWith": [
                            "portfolioStockId"
                        ]
                    }
                },
                "owner": {
                    "name": "owner",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "createdAt": {
                    "name": "createdAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": [],
                    "isReadOnly": true
                },
                "updatedAt": {
                    "name": "updatedAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": [],
                    "isReadOnly": true
                }
            },
            "syncable": true,
            "pluralName": "PortfolioStocks",
            "attributes": [
                {
                    "type": "model",
                    "properties": {}
                },
                {
                    "type": "auth",
                    "properties": {
                        "rules": [
                            {
                                "provider": "userPools",
                                "ownerField": "owner",
                                "allow": "owner",
                                "identityClaim": "cognito:username",
                                "operations": [
                                    "create",
                                    "update",
                                    "delete",
                                    "read"
                                ]
                            },
                            {
                                "allow": "public",
                                "provider": "apiKey",
                                "operations": [
                                    "create",
                                    "read",
                                    "delete",
                                    "update"
                                ]
                            }
                        ]
                    }
                }
            ]
        },
        "Transaction": {
            "name": "Transaction",
            "fields": {
                "id": {
                    "name": "id",
                    "isArray": false,
                    "type": "ID",
                    "isRequired": true,
                    "attributes": []
                },
                "date": {
                    "name": "date",
                    "isArray": false,
                    "type": "AWSDate",
                    "isRequired": true,
                    "attributes": []
                },
                "action": {
                    "name": "action",
                    "isArray": false,
                    "type": {
                        "enum": "TxnAction"
                    },
                    "isRequired": true,
                    "attributes": []
                },
                "signal": {
                    "name": "signal",
                    "isArray": false,
                    "type": {
                        "enum": "TxnSignal"
                    },
                    "isRequired": false,
                    "attributes": []
                },
                "price": {
                    "name": "price",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "investment": {
                    "name": "investment",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "quantity": {
                    "name": "quantity",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "swingShares": {
                    "name": "swingShares",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "holdShares": {
                    "name": "holdShares",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "txnType": {
                    "name": "txnType",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "archived": {
                    "name": "archived",
                    "isArray": false,
                    "type": "Boolean",
                    "isRequired": false,
                    "attributes": []
                },
                "archivedAt": {
                    "name": "archivedAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": []
                },
                "lbd": {
                    "name": "lbd",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "tp": {
                    "name": "tp",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "completedTxnId": {
                    "name": "completedTxnId",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "txnProfit": {
                    "name": "txnProfit",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "txnProfitPercent": {
                    "name": "txnProfitPercent",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "portfolioStockId": {
                    "name": "portfolioStockId",
                    "isArray": false,
                    "type": "ID",
                    "isRequired": true,
                    "attributes": []
                },
                "portfolioStock": {
                    "name": "portfolioStock",
                    "isArray": false,
                    "type": {
                        "model": "PortfolioStock"
                    },
                    "isRequired": false,
                    "attributes": [],
                    "association": {
                        "connectionType": "BELONGS_TO",
                        "targetNames": [
                            "portfolioStockId"
                        ]
                    }
                },
                "owner": {
                    "name": "owner",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "createdAt": {
                    "name": "createdAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": [],
                    "isReadOnly": true
                },
                "updatedAt": {
                    "name": "updatedAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": [],
                    "isReadOnly": true
                }
            },
            "syncable": true,
            "pluralName": "Transactions",
            "attributes": [
                {
                    "type": "model",
                    "properties": {}
                },
                {
                    "type": "auth",
                    "properties": {
                        "rules": [
                            {
                                "provider": "userPools",
                                "ownerField": "owner",
                                "allow": "owner",
                                "identityClaim": "cognito:username",
                                "operations": [
                                    "create",
                                    "update",
                                    "delete",
                                    "read"
                                ]
                            },
                            {
                                "allow": "public",
                                "provider": "apiKey",
                                "operations": [
                                    "create",
                                    "read",
                                    "delete",
                                    "update"
                                ]
                            }
                        ]
                    }
                }
            ]
        },
        "PortfolioGoals": {
            "name": "PortfolioGoals",
            "fields": {
                "id": {
                    "name": "id",
                    "isArray": false,
                    "type": "ID",
                    "isRequired": true,
                    "attributes": []
                },
                "totalBudget": {
                    "name": "totalBudget",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "usBudgetPercent": {
                    "name": "usBudgetPercent",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "intBudgetPercent": {
                    "name": "intBudgetPercent",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "usStocksTarget": {
                    "name": "usStocksTarget",
                    "isArray": false,
                    "type": "Int",
                    "isRequired": false,
                    "attributes": []
                },
                "usEtfsTarget": {
                    "name": "usEtfsTarget",
                    "isArray": false,
                    "type": "Int",
                    "isRequired": false,
                    "attributes": []
                },
                "intStocksTarget": {
                    "name": "intStocksTarget",
                    "isArray": false,
                    "type": "Int",
                    "isRequired": false,
                    "attributes": []
                },
                "intEtfsTarget": {
                    "name": "intEtfsTarget",
                    "isArray": false,
                    "type": "Int",
                    "isRequired": false,
                    "attributes": []
                },
                "createdAt": {
                    "name": "createdAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": [],
                    "isReadOnly": true
                },
                "updatedAt": {
                    "name": "updatedAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": [],
                    "isReadOnly": true
                }
            },
            "syncable": true,
            "pluralName": "PortfolioGoals",
            "attributes": [
                {
                    "type": "model",
                    "properties": {}
                },
                {
                    "type": "auth",
                    "properties": {
                        "rules": [
                            {
                                "provider": "userPools",
                                "ownerField": "owner",
                                "allow": "owner",
                                "identityClaim": "cognito:username",
                                "operations": [
                                    "create",
                                    "update",
                                    "delete",
                                    "read"
                                ]
                            },
                            {
                                "allow": "public",
                                "provider": "apiKey",
                                "operations": [
                                    "create",
                                    "read",
                                    "delete",
                                    "update"
                                ]
                            }
                        ]
                    }
                }
            ]
        },
        "StockWallet": {
            "name": "StockWallet",
            "fields": {
                "id": {
                    "name": "id",
                    "isArray": false,
                    "type": "ID",
                    "isRequired": true,
                    "attributes": []
                },
                "portfolioStockId": {
                    "name": "portfolioStockId",
                    "isArray": false,
                    "type": "ID",
                    "isRequired": true,
                    "attributes": []
                },
                "walletType": {
                    "name": "walletType",
                    "isArray": false,
                    "type": {
                        "enum": "WalletType"
                    },
                    "isRequired": true,
                    "attributes": []
                },
                "portfolioStock": {
                    "name": "portfolioStock",
                    "isArray": false,
                    "type": {
                        "model": "PortfolioStock"
                    },
                    "isRequired": false,
                    "attributes": [],
                    "association": {
                        "connectionType": "BELONGS_TO",
                        "targetNames": [
                            "portfolioStockId"
                        ]
                    }
                },
                "buyPrice": {
                    "name": "buyPrice",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": true,
                    "attributes": []
                },
                "totalSharesQty": {
                    "name": "totalSharesQty",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": true,
                    "attributes": []
                },
                "totalInvestment": {
                    "name": "totalInvestment",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": true,
                    "attributes": []
                },
                "sharesSold": {
                    "name": "sharesSold",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": true,
                    "attributes": []
                },
                "remainingShares": {
                    "name": "remainingShares",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "archived": {
                    "name": "archived",
                    "isArray": false,
                    "type": "Boolean",
                    "isRequired": false,
                    "attributes": []
                },
                "archivedAt": {
                    "name": "archivedAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": []
                },
                "realizedPl": {
                    "name": "realizedPl",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "tpValue": {
                    "name": "tpValue",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "tpPercent": {
                    "name": "tpPercent",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "realizedPlPercent": {
                    "name": "realizedPlPercent",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "sellTxnCount": {
                    "name": "sellTxnCount",
                    "isArray": false,
                    "type": "Int",
                    "isRequired": true,
                    "attributes": []
                },
                "owner": {
                    "name": "owner",
                    "isArray": false,
                    "type": "String",
                    "isRequired": false,
                    "attributes": []
                },
                "createdAt": {
                    "name": "createdAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": [],
                    "isReadOnly": true
                },
                "updatedAt": {
                    "name": "updatedAt",
                    "isArray": false,
                    "type": "AWSDateTime",
                    "isRequired": false,
                    "attributes": [],
                    "isReadOnly": true
                }
            },
            "syncable": true,
            "pluralName": "StockWallets",
            "attributes": [
                {
                    "type": "model",
                    "properties": {}
                },
                {
                    "type": "auth",
                    "properties": {
                        "rules": [
                            {
                                "provider": "userPools",
                                "ownerField": "owner",
                                "allow": "owner",
                                "identityClaim": "cognito:username",
                                "operations": [
                                    "create",
                                    "update",
                                    "delete",
                                    "read"
                                ]
                            },
                            {
                                "allow": "public",
                                "provider": "apiKey",
                                "operations": [
                                    "create",
                                    "read",
                                    "delete",
                                    "update"
                                ]
                            }
                        ]
                    }
                }
            ]
        }
    },
    "enums": {
        "StockType": {
            "name": "StockType",
            "values": [
                "Stock",
                "ETF",
                "Crypto"
            ]
        },
        "Region": {
            "name": "Region",
            "values": [
                "APAC",
                "EU",
                "Intl",
                "US"
            ]
        },
        "StockTrend": {
            "name": "StockTrend",
            "values": [
                "Down",
                "Up",
                "Sideways"
            ]
        },
        "TxnAction": {
            "name": "TxnAction",
            "values": [
                "Buy",
                "Sell",
                "Div"
            ]
        },
        "TxnSignal": {
            "name": "TxnSignal",
            "values": [
                "_5DD",
                "Cust",
                "Initial",
                "EOM",
                "LBD",
                "TPH",
                "TPP",
                "TP",
                "Div"
            ]
        },
        "WalletType": {
            "name": "WalletType",
            "values": [
                "Swing",
                "Hold"
            ]
        }
    },
    "nonModels": {
        "HistoricalCloseInput": {
            "name": "HistoricalCloseInput",
            "fields": {
                "date": {
                    "name": "date",
                    "isArray": false,
                    "type": "String",
                    "isRequired": true,
                    "attributes": []
                },
                "close": {
                    "name": "close",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": true,
                    "attributes": []
                }
            }
        },
        "PriceResult": {
            "name": "PriceResult",
            "fields": {
                "symbol": {
                    "name": "symbol",
                    "isArray": false,
                    "type": "String",
                    "isRequired": true,
                    "attributes": []
                },
                "currentPrice": {
                    "name": "currentPrice",
                    "isArray": false,
                    "type": "Float",
                    "isRequired": false,
                    "attributes": []
                },
                "historicalCloses": {
                    "name": "historicalCloses",
                    "isArray": true,
                    "type": {
                        "nonModel": "HistoricalCloseInput"
                    },
                    "isRequired": false,
                    "attributes": [],
                    "isArrayNullable": false
                }
            }
        }
    },
    "codegenVersion": "3.4.4",
    "version": "17152d155ac8cdc9aefe16750ab40163"
};