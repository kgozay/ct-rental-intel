const assert = require('assert');
const {
  isValid,
  parseAvailableDate,
  extractBedrooms,
  extractBathrooms,
  extractSize,
  extractFurnished,
  normaliseListing,
  computeValueScores
} = require('../api/normalise.js');

console.log("=== RUNNING EXTENDED RENTAL INTEL TEST SUITE ===\n");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(err);
    failed++;
  }
}

// 1. isValid tests
test("isValid - accepts valid apartment listing", () => {
  assert.strictEqual(isValid({
    pricing: { price: 18500, price_text: "R 18 500" },
    property: { property_type: "Apartment / Flat" }
  }), true);
});

test("isValid - accepts house and townhouse", () => {
  assert.strictEqual(isValid({
    pricing: { price: 35000 },
    property: { property_type: "House" }
  }), true);
  assert.strictEqual(isValid({
    pricing: { price: 25000 },
    property: { property_type: "Townhouse" }
  }), true);
});

test("isValid - accepts compound residential types (Studio Flat, Bachelor, Garden Cottage, Loft)", () => {
  assert.strictEqual(isValid({
    pricing: { price: 12000 },
    property: { property_type: "Studio Flat" }
  }), true);
  assert.strictEqual(isValid({
    pricing: { price: 11000 },
    property: { property_type: "Bachelor Apartment" }
  }), true);
  assert.strictEqual(isValid({
    pricing: { price: 14000 },
    property: { property_type: "Garden Cottage" }
  }), true);
  assert.strictEqual(isValid({
    pricing: { price: 22000 },
    property: { property_type: "Loft Apartment" }
  }), true);
});

test("isValid - drops POA listings", () => {
  assert.strictEqual(isValid({
    pricing: { price: null, price_text: "POA" },
    property: { property_type: "Apartment" }
  }), false);
});

test("isValid - drops commercial and non-residential properties", () => {
  assert.strictEqual(isValid({
    pricing: { price: 40000 },
    property: { property_type: "Commercial Property" }
  }), false);
  assert.strictEqual(isValid({
    pricing: { price: 20000 },
    property: { property_type: "Office" }
  }), false);
  assert.strictEqual(isValid({
    pricing: { price: 15000 },
    property: { property_type: "Retail" }
  }), false);
  assert.strictEqual(isValid({
    pricing: { price: 30000 },
    property: { property_type: "Warehouse" }
  }), false);
});

test("isValid - enforces price sanity bounds", () => {
  assert.strictEqual(isValid({
    pricing: { price: 0 },
    property: { property_type: "Apartment" }
  }), false);
  assert.strictEqual(isValid({
    pricing: { price: 200000 },
    property: { property_type: "Apartment" }
  }), false);
});

// 2. parseAvailableDate tests
test("parseAvailableDate - handles NOW and IMMEDIATELY", () => {
  const today = new Date().toISOString().split('T')[0];
  assert.strictEqual(parseAvailableDate("AVAILABLE NOW"), today);
  assert.strictEqual(parseAvailableDate("AVAILABLE IMMEDIATELY"), today);
  assert.strictEqual(parseAvailableDate("IMMEDIATE"), today);
  assert.strictEqual(parseAvailableDate("Now"), today);
});

test("parseAvailableDate - parses AVAILABLE: 01 JUL format", () => {
  const parsed = parseAvailableDate("AVAILABLE: 01 JUL");
  assert.ok(parsed);
  assert.match(parsed, /^\d{4}-07-01$/);
});

test("parseAvailableDate - parses full month and from formats", () => {
  const parsed = parseAvailableDate("Available from 15 August 2026");
  assert.strictEqual(parsed, "2026-08-15");
});

// 3. extractBedrooms & extractBathrooms tests
test("extractBedrooms - handles numeric and text representations", () => {
  assert.strictEqual(extractBedrooms("2 Bed Apartment", "", null), 2);
  assert.strictEqual(extractBedrooms("Studio in Sea Point", "", null), 0.5);
  assert.strictEqual(extractBedrooms("", "", 3), 3);
});

test("extractBathrooms - handles raw and text", () => {
  assert.strictEqual(extractBathrooms("1.5 Bath Flat", "", null), 1.5);
  assert.strictEqual(extractBathrooms("", "", 2), 2);
});

// 4. extractSize tests
test("extractSize - handles various sqm notations", () => {
  assert.strictEqual(extractSize("85 sqm flat", "", null), 85);
  assert.strictEqual(extractSize("Spacious 120 m² unit", "", null), 120);
  assert.strictEqual(extractSize("", "", "95"), 95);
  assert.strictEqual(extractSize("Too small 4 sqm", "", null), null); // below min sanity
});

// 5. extractFurnished tests
test("extractFurnished - identifies furnished vs unfurnished", () => {
  assert.strictEqual(extractFurnished("Fully furnished 2 bed", "", null), true);
  assert.strictEqual(extractFurnished("Unfurnished apartment", "", null), false);
  assert.strictEqual(extractFurnished("", "", true), true);
  assert.strictEqual(extractFurnished("", "", false), false);
});

// 6. normaliseListing & computeValueScores tests
test("normaliseListing & computeValueScores - computes accurate value scores", () => {
  const rawListings = [
    {
      record_id: "101",
      pricing: { price: 20000, price_text: "R 20 000" },
      property: { property_type: "Apartment", bedrooms: 2, bathrooms: 1, floor_area: { value: 100 } },
      location: { locality: "Sea Point, Cape Town" },
      source_context: { listing_url: "https://p24.com/101" }
    },
    {
      record_id: "102",
      pricing: { price: 30000, price_text: "R 30 000" },
      property: { property_type: "Apartment", bedrooms: 2, bathrooms: 2, floor_area: { value: 100 } },
      location: { locality: "Sea Point, Cape Town" },
      source_context: { listing_url: "https://p24.com/102" }
    },
    {
      record_id: "103",
      pricing: { price: 25000, price_text: "R 25 000" },
      property: { property_type: "Apartment", bedrooms: 2, bathrooms: 1, floor_area: { value: 100 } },
      location: { locality: "Sea Point, Cape Town" },
      source_context: { listing_url: "https://p24.com/103" }
    }
  ];

  const normalised = rawListings.map(normaliseListing);
  assert.strictEqual(normalised[0].price_per_m2, 200); // 20000 / 100
  assert.strictEqual(normalised[1].price_per_m2, 300); // 30000 / 100
  assert.strictEqual(normalised[2].price_per_m2, 250); // 25000 / 100

  const scored = computeValueScores(normalised);
  // Median R/m² for Sea Point is 250
  // Listing 101: 250 / 200 = 1.25 (> 1.15 -> Good Value)
  // Listing 102: 250 / 300 = 0.83 (< 0.85 -> Expensive)
  // Listing 103: 250 / 250 = 1.00 (Fair)
  assert.strictEqual(scored[0].value_score, 1.25);
  assert.strictEqual(scored[1].value_score, 0.83);
  assert.strictEqual(scored[2].value_score, 1.00);
});

// 7. Test AI Handlers with Mock Requests
test("api/analyse.js handler responds gracefully", async () => {
  const handler = require('../api/analyse.js');
  let statusCode = null;
  let responseData = null;
  const mockReq = {
    method: 'POST',
    body: {
      listings: [
        { suburb: 'Sea Point', price: 22000, bedrooms: 2, price_per_m2: 280, value_score: 1.18, furnished: true },
        { suburb: 'Gardens', price: 14500, bedrooms: 1, price_per_m2: 220, value_score: 1.25, furnished: false }
      ],
      context: { suburb: 'Sea Point, Gardens', maxPrice: 40000 }
    }
  };
  const mockRes = {
    setHeader: () => {},
    status: (code) => {
      statusCode = code;
      return mockRes;
    },
    json: (data) => {
      responseData = data;
      return mockRes;
    }
  };

  await handler(mockReq, mockRes);
  assert.strictEqual(statusCode, 200);
  assert.ok(responseData.analysis);
  assert.ok(responseData.analysis.includes('Gardens') || responseData.analysis.includes('Sea Point'));
});

test("api/verdict.js handler responds with heuristic verdict", async () => {
  const handler = require('../api/verdict.js');
  let statusCode = null;
  let responseData = null;
  const mockReq = {
    method: 'POST',
    body: {
      listing: { suburb: 'Gardens', price: 15000, bedrooms: 1, size_m2: 60, price_per_m2: 250, furnished: false },
      suburbMedianPrice: 18000
    }
  };
  const mockRes = {
    setHeader: () => {},
    status: (code) => {
      statusCode = code;
      return mockRes;
    },
    json: (data) => {
      responseData = data;
      return mockRes;
    }
  };

  await handler(mockReq, mockRes);
  assert.strictEqual(statusCode, 200);
  assert.ok(responseData.verdict);
  assert.ok(responseData.verdict.includes('Gardens'));
});

console.log(`\n========================================`);
console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed.`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
