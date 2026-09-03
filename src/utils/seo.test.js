import {
  applyPublicSeo,
  buildPartnerSeo,
  buildStorefrontSeo,
} from "./seo";

describe("public storefront SEO", () => {
  test("uses the partner name for partner pages", () => {
    const seo = buildPartnerSeo({
      partner: { name: "MyCrushPizza", slug: "mycrushpizza" },
      partnerSlug: "mycrushpizza",
    });

    expect(seo.title).toBe("MyCrushPizza | Tienda oficial");
    expect(seo.title).not.toContain("Volta Pizza");
  });

  test("adds the partner city when there is one active city", () => {
    const seo = buildPartnerSeo({
      partner: {
        name: "MyCrushPizza",
        slug: "mycrushpizza",
        stores: [{ storeName: "Plaza Diario", slug: "plaza-diario", city: "Ourense", active: true }],
      },
      partnerSlug: "mycrushpizza",
    });

    expect(seo.title).toBe("MyCrushPizza | Tienda oficial en Ourense");
    expect(seo.description).toContain("MyCrushPizza en Ourense");
  });

  test("uses the partner and city for city-named store pages", () => {
    const seo = buildStorefrontSeo({
      partner: { name: "MyCrushPizza", slug: "mycrushpizza", country: "ES" },
      store: {
        storeName: "Ourense",
        slug: "ourense",
        city: "Ourense",
        address: "Rua Example 1",
        deliveryEnabled: true,
        pickupEnabled: true,
      },
      partnerSlug: "mycrushpizza",
      storeSlug: "ourense",
    });

    expect(seo.title).toBe("MyCrushPizza en Ourense | Tienda oficial");
    expect(seo.description).toContain("MyCrushPizza en Ourense");
    expect(seo.title).not.toContain("Volta Pizza");
  });

  test("applies title and social metadata to the document head", () => {
    applyPublicSeo({
      title: "Micro Pizza | Tienda oficial",
      description: "Carta online de Micro Pizza.",
      canonicalUrl: "https://voltapizza.com/micro-pizza",
    });

    expect(document.title).toBe("Micro Pizza | Tienda oficial");
    expect(document.querySelector('meta[property="og:title"]').content).toBe(
      "Micro Pizza | Tienda oficial"
    );
    expect(document.querySelector('link[rel="canonical"]').href).toBe(
      "https://voltapizza.com/micro-pizza"
    );
  });
});
