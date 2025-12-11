import { a, defineData, type ClientSchema } from "@aws-amplify/backend";

const schema = a.schema({
  // Enums
  AssetType: a.enum(["STOCK", "ETF", "CRYPTO"]),
  AssetStatus: a.enum(["ACTIVE", "HIDDEN", "ARCHIVED"]),

  // Asset - Primary table for stocks, ETFs, and crypto
  Asset: a
    .model({
      symbol: a.string().required(),
      name: a.string().required(),
      type: a.ref("AssetType").required(),
      testPrice: a.float(), // For E2E testing signals
      commission: a.float(), // Percentage per sell transaction
      status: a.ref("AssetStatus").required(),
      // Relationships
      yearlyBudgets: a.hasMany("YearlyBudget", "assetId"),
      profitTargets: a.hasMany("ProfitTarget", "assetId"),
      entryTargets: a.hasMany("EntryTarget", "assetId"),
    })
    .authorization((allow) => [allow.owner()]),

  // YearlyBudget - Annual budget per asset for ROI tracking
  YearlyBudget: a
    .model({
      year: a.integer().required(),
      amount: a.float().required(),
      // Relationship
      assetId: a.id().required(),
      asset: a.belongsTo("Asset", "assetId"),
    })
    .authorization((allow) => [allow.owner()]),

  // ProfitTarget - Tiered sell signals when price increases
  ProfitTarget: a
    .model({
      name: a.string().required(),
      targetPercent: a.float().required(),
      allocationPercent: a.float(), // Optional - % of shares to sell
      sortOrder: a.integer().required(),
      // Relationship
      assetId: a.id().required(),
      asset: a.belongsTo("Asset", "assetId"),
    })
    .authorization((allow) => [allow.owner()]),

  // EntryTarget - Tiered buy signals when price decreases
  EntryTarget: a
    .model({
      name: a.string().required(),
      targetPercent: a.float().required(), // Stored as positive
      sortOrder: a.integer().required(),
      // Relationship
      assetId: a.id().required(),
      asset: a.belongsTo("Asset", "assetId"),
    })
    .authorization((allow) => [allow.owner()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
  },
});
