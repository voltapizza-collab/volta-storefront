import React, { useEffect, useState } from "react";
import "../../styles/IngredientsModule.css";
import { Tree } from "react-arborist";
import api from "../../setupAxios";


const INGREDIENTS_LEGACY_BASE = {

  QUESOS: [
    { name: "Mozzarella", allergens: ["MILK"] },
    { name: "Arzua", allergens: ["MILK"] },
    { name: "Cheddar", allergens: ["MILK"] },
    { name: "Parmesano", allergens: ["MILK"] },
    { name: "Gorgonzola", allergens: ["MILK"] },
    { name: "Queso azul", allergens: ["MILK"] },
    { name: "Burrata", allergens: ["MILK"] },
    { name: "Ricotta", allergens: ["MILK"] },
    { name: "Queso de cabra", allergens: ["MILK"] },
    { name: "Emmental", allergens: ["MILK"] },
    { name: "Provolone", allergens: ["MILK"] },
    { name: "Relleno de Mozzarela", allergens: ["MILK"] },
    { name: "1kg Relleno de Mozzarela", allergens: ["MILK"] }
  ],

  SALSAS: [
    { name: "Salsa Tomate", allergens: [] },
    { name: "Salsa BBQ", allergens: [] },
    { name: "Salsa Pesto", allergens: ["NUTS"] },
    { name: "Salsa esparragos", allergens: ["MILK"] },
    { name: "Salsa picante", allergens: [] },
    { name: "Salsa de ajo", allergens: ["EGG"] },
    { name: "Salsa de arándanos", allergens: ["MILK"] },
    { name: "Salsa miel-mostaza", allergens: ["MUSTARD"] }
  ],

  CARNES: [
    { name: "Pepperoni", allergens: [] },
    { name: "Bacon", allergens: [] },
    { name: "Pollo", allergens: [] },
    { name: "Carne Picada", allergens: [] },
    { name: "Chorizo", allergens: [] },
    { name: "Salchicha italiana", allergens: [] }
  ],

  FIAMBRES: [
    { name: "Jamón cocido (York)", allergens: [] },
    { name: "Jamón serrano", allergens: [] },
    { name: "Prosciutto", allergens: [] },
    { name: "Pavo", allergens: [] },
    { name: "Salami", allergens: [] },
    { name: "Mortadela", allergens: ["NUTS"] }
  ],

  PESCADOS: [
    { name: "Atún", allergens: ["FISH"] },
    { name: "Anchoas", allergens: ["FISH"] },
    { name: "Salmón", allergens: ["FISH"] }
  ],

  MARISCOS: [
    { name: "Camarones", allergens: ["SHELLFISH"] },
    { name: "Langostinos", allergens: ["SHELLFISH"] },
    { name: "Cangrejo", allergens: ["SHELLFISH"] },
    { name: "Pulpo", allergens: ["SHELLFISH"] },
    { name: "Mejillones", allergens: ["SHELLFISH"] }
  ],

  CREMAS_DULCES: [
  { name: "Avellana blanca", allergens: ["MILK", "TREE_NUTS", "SOY"] },
  { name: "Avellana tradicional", allergens: ["MILK", "TREE_NUTS", "SOY"] },
  { name: "Pistacho", allergens: ["MILK", "TREE_NUTS", "SOY"] },
  { name: "Lotus Biscoff", allergens: ["WHEAT", "SOY"] },
  { name: "Dulce de leche", allergens: ["MILK"] },
  { name: "Leche condensada", allergens: ["MILK"] },
  { name: "Chocolate blanco", allergens: ["MILK", "SOY"] },
  { name: "Chocolate con leche", allergens: ["MILK", "SOY"] },
  { name: "Chocolate oscuro", allergens: ["SOY"] },
  { name: "Nutella", allergens: ["MILK", "TREE_NUTS", "SOY"] },
  { name: "Crema de almendras", allergens: ["TREE_NUTS"] },
  { name: "Crema de maní", allergens: ["PEANUTS"] },
  { name: "Crema de coco", allergens: ["TREE_NUTS"] },
  { name: "Crema de vainilla", allergens: ["MILK", "EGGS"] },
  { name: "Crema pastelera", allergens: ["MILK", "EGGS", "WHEAT"] },
  { name: "Crema de queso dulce", allergens: ["MILK"] }
],
ENDULZANTES: [
  { name: "Miel", allergens: [] },
  { name: "Azúcar", allergens: [] },
  { name: "Azúcar glass", allergens: [] },
  { name: "Sirope de maple", allergens: [] },
  { name: "Sirope de agave", allergens: [] },
  { name: "Caramelo", allergens: ["MILK"] }
],

  VERDURAS: [
    { name: "Cebolla", allergens: [] },
    { name: "Pimiento verde", allergens: [] },
    { name: "Pimiento rojo", allergens: [] },
    { name: "Pimiento amarillo", allergens: [] },
    { name: "Maíz", allergens: [] },
    { name: "Tomate fresco", allergens: [] },
    { name: "Rúcula", allergens: [] },
    { name: "Espinaca", allergens: [] },
    { name: "Berenjena", allergens: [] },
    { name: "Calabacín", allergens: [] },
    { name: "Aceitunas negras", allergens: [] },
    { name: "Aceitunas verdes", allergens: [] },
    { name: "Alcachofa", allergens: [] }
  ],

  SETAS: [
    { name: "Champiñones", allergens: [] },
    { name: "Portobello", allergens: [] },
    { name: "Trufa", allergens: [] }
  ],

  FRUTAS: [
    { name: "Piña", allergens: [] },
    { name: "Higos", allergens: [] },
    { name: "Manzana", allergens: [] },
    { name: "Pera", allergens: [] }
  ],

  ESPECIAS: [
    { name: "Orégano", allergens: [] },
    { name: "Chili flakes", allergens: [] },
    { name: "Ajo", allergens: [] },
    { name: "Albahaca", allergens: [] }
  ],

  ACEITES: [
    { name: "Aceite de oliva", allergens: [] },
    { name: "Aceite picante", allergens: [] }
  ],

  EXTRAS: [
    { name: "Huevo", allergens: ["EGG"] }
  ]

};

const withAllergens = (names, allergens = []) =>
  names.map((name) => ({ name, allergens }));

const parseIngredientList = (value) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, allergens = ""] = line.split("|");
      return {
        name: name.trim(),
        allergens: allergens
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      };
    });

const normalizeAllergen = (allergen) =>
  String(allergen || "").trim().toUpperCase() === "LACTOSE"
    ? "MILK"
    : String(allergen || "").trim().toUpperCase();

const normalizeBaseIngredient = (item) => ({
  ...item,
  allergens: [...new Set((item.allergens || []).map(normalizeAllergen).filter(Boolean))],
});

const normalizeIngredientKey = (name) =>
  String(name || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const CATEGORY_ALIASES = {
  ACEITES: "ACEITES_GRASAS_VINAGRES",
  ACEITES_GRASAS_VINAGRES: "ACEITES_GRASAS_VINAGRES",
  ESPECIAS: "HIERBAS_ESPECIAS",
  HIERBAS_ESPECIAS: "HIERBAS_ESPECIAS",
  FIAMBRES: "EMBUTIDOS",
  EMBUTIDOS: "EMBUTIDOS",
  MARISCOS: "PESCADOS_Y_MARISCOS",
  PESCADOS: "PESCADOS_Y_MARISCOS",
  PESCADOS_Y_MARISCOS: "PESCADOS_Y_MARISCOS",
  SALSAS_CREMAS: "SALSAS",
  SALSAS: "SALSAS",
};

const normalizeCategory = (category) =>
  String(category || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const getCanonicalCategory = (category) => {
  const normalized = normalizeCategory(category);
  return CATEGORY_ALIASES[normalized] || normalized;
};

const mergeIngredientBases = (...bases) => {
  const merged = {};
  const seen = new Set();

  bases.forEach((base) => {
    Object.entries(base).forEach(([category, items]) => {
      const canonicalCategory = getCanonicalCategory(category);
      if (!merged[canonicalCategory]) merged[canonicalCategory] = [];

      items.map(normalizeBaseIngredient).forEach((item) => {
        const key = normalizeIngredientKey(item.name);
        if (!key || seen.has(key)) return;

        seen.add(key);
        merged[canonicalCategory].push(item);
      });
    });
  });

  return merged;
};

const INGREDIENTS_EXTENDED_BASE = {
  QUESOS: [
    ...withAllergens(
      [
      "Aaaruul",
      "Akkawi",
      "Asiago",
      "Ayibe",
      "Beyaz peynir",
      "Bocconcini",
      "Brie",
      "Bryndza",
      "Caciocavallo",
      "Camembert",
      "Casu marzu",
      "Catupiry",
      "Cheddar Ahumado",
      "Cheddar blanco",
      "Cheddar extra maduro",
      "Cheddar fundido",
      "Cheddar maduro",
      "Cheddar rojo",
      "Cheddar Vermont",
      "Cheddar vintage / extra anejo",
      "Chhurpi",
      "Comte",
      "Cottage",
      "Cuajo de oveja",
      "Edam",
      "Fontina",
      "Gbejna",
      "Grana Padano",
      "Graddost",
      "Graviera",
      "Halloumi",
      "Kachkeis",
      "Kajmak",
      "Kasar peyniri",
      "Kasseri",
      "Kashkaval",
      "Kefalotyri",
      "Kesong puti",
      "Kurut",
      "Labneh",
      "Mascarpone",
      "Mascarpone vainilla",
      "Montasio",
      "Monterey Jack",
      "Mozzarella ahumada",
      "Mozzarella de bufala",
      "Mozzarella toonsbridge",
      "Mozzarella de vaca",
      "Nabulsi",
      "Oscypek / Queso ahumado de oveja",
      "Paneer",
      "Parmigiano Reggiano",
      "Pecorino romano",
      "Piave Vecchio",
      "Piton Maido",
      "Pljevlja / queso de oveja de Pljevlja",
      "Provel",
      "Provolone ahumado",
      "Provolone picante",
      "Provolone Valpadana AOP",
      "Queijo coalho",
      "Queso ardsallagh",
      "Queso cabrales",
      "Queso cheddar en polvo",
      "Queso crema",
      "Queso de cabra curado",
      "Queso chanco",
      "Queso chhena",
      "Queso Chihuahua",
      "Queso coolea farmhouse",
      "Queso costeno",
      "Queso cotija",
      "Queso de oveja",
      "Queso deshidratado",
      "Queso duro",
      "Queso duro blando",
      "Queso duro de oveja",
      "Queso feta",
      "Queso fontal",
      "Queso fresco",
      "Queso gouda",
      "Queso gouda ahumado",
      "Queso guayanes",
      "Queso de hoja",
      "Queso hungaro anejo",
      "Queso Jarlsberg",
      "Queso llanero",
      "Queso maasdam",
      "Queso Mar del Plata",
      "Queso de Oaxaca",
      "Queso panela",
      "Queso paria",
      "Queso provola",
      "Queso provola silana",
      "Queso quark",
      "Queso raclette",
      "Queso Romano",
      "Queso Roumi",
      "Queso Saint-Maure",
      "Queso sakura",
      "Queso sardo",
      "Queso Stilton",
      "Queso Stracchino",
      "Queso suizo",
      "Queso sulguni",
      "Queso tasty",
      "Queso toma",
      "Queso Tvorog",
      "Queso uzbek",
      "Queso Vasterbottenost",
      "Queso de yak",
      "Queso yuki",
      "Reblochon",
      "Red Leicester",
      "Regato",
      "Requeijao cremoso",
      "Ricotta di pecora",
      "Ricotta salata",
      "Roquefort",
      "Rulo de cabra",
      "Scamorza",
      "Scamorza ahumada",
      "Sirene",
      "Stracciatella di burrata",
      "Telemea",
      "Ube ricotta / ricotta de name morado",
      ],
      ["MILK"]
    ),
    ...parseIngredientList(`
Catupiry vegetal
Mozzarella sin lactosa
Mozzarella vegetal
Mozzarisella
Queso ahumado de granja
Queso de arroz
Queso estilo parmesano vegetal
Queso Vegano
`),
  ],
  PESCADOS_Y_MARISCOS: parseIngredientList(`
Almejas|SHELLFISH
Almejas venus|SHELLFISH
Anchoas|FISH
Anguilas|FISH
Arenque ahumado|FISH
Arenque encurtido|FISH
Arenque rojo|FISH
Atun|FISH
Bacalao salado|FISH
Bagre|FISH
Barramundi|FISH
Bogavante|SHELLFISH
Bottarga|FISH
Caballa|FISH
Calamares|SHELLFISH
Camarones deshidratados|SHELLFISH
Camarones nordicos|SHELLFISH
Cangrejo de rio|SHELLFISH
Caracola|SHELLFISH
Caviar|EGG,FISH
Chambo|FISH
Cigala islandesa|SHELLFISH
Erizo de mar|SHELLFISH
Espadin ahumado|FISH
Hakarl / Tiburon fermentado|FISH
Hokkaido uni / Erizo de mar de Hokkaido|SHELLFISH
Huevas / roe|FISH
Ikra / Huevas de salmon|FISH
Kanikama / crab stick|SHELLFISH
Kapenta|FISH
Keong khas Banyubiru|SHELLFISH
Kingfish / Pez rey del Golfo|FISH
Langosta|SHELLFISH
Listao|FISH
Mejillones ahumados|SHELLFISH
Mentaiko / Huevas de abadejo|FISH
Ndomba de Silure / Bagre africano|FISH
Ostiones|SHELLFISH
Ostras|SHELLFISH
Pota|SHELLFISH
Roget al|FISH
Salmon del pacifico|FISH
Sardinas|FISH
Sepia|SHELLFISH
Scungilli / Caracola|SHELLFISH
Shirasu|FISH
Trucha|FISH
Trucha ahumada|FISH
Unagi|FISH
Vieiras|SHELLFISH
Vieiras Hokkaido|SHELLFISH
`),
  CARNES: parseIngredientList(`
Albondigas
Alce
Alitas de pollo
Avestruz
Biltong|SULFITES
Buey
Buey almizclero
Bufalo
Caballo
Cabra
Camello
Canguro
Caracoles malteses
Carne de res enlatada
Carne de cerdo
Carne de res
Carne de vacuno
Cebu
Cecina
Cerdo
Cerdo desmenuzado
Chicharron de cerdo
Cocodrilo / caiman
Codillo de cerdo
Cordero
Costillas de cerdo mangalica
Emu
Escargots de Bourgogne
Foca
Foie gras
Iguana
Intestinos de cerdo
Jabali
Kudu
Lardons
Lengua de res
Lomo iberico
Oryx
Paleta de cerdo cocida
Pato
Pato marinado
Pavo asado
Pechuga de pollo
Pernil
Pollo ahumado
Pollo a la brasa
Pollo asado marinado
Pollo desmenuzado
Pollo doner kebab
Pollo en tira
Pollo frito
Pork floss / Cerdo deshebrado seco
Rabo de buey
Rana toro
Reno
Reno ahumado
Res
Res ahumada
Serpiente
Springbok
Spam
Ternera
Ternera asada
Ternera blanca
Udene maso
Vacuno
Vacuno desmenuzado
Venado
`),
  EMBUTIDOS: parseIngredientList(`
Bacon ahumado
Bacon curado con jarabe de arce
Boczek / Bacon polaco ahumado
Boerewors
Botillo
Bresaola
Butifarra
Cabanossi
Carnaciori
Chourico
Chorizo ahumado
Chorizo cocido
Chorizo dulce
Chorizo espanol
Chorizo guatemalteco
Chorizo gubbeen
Chorizo iberico
Chorizo mexicano
Chorizo picante
Chorizo picante Calabrese
Chorizo superior
Chorizo de venado
Coppa / Capocollo|SULFITES
Gamonal
Guanciale|SULFITES
Jamon ahumado
Jamon cocido (York)
Jamon cocido Ahumado (York Ahumado)
Jamon de Jinhua
Jamon de pavo
Jamon Rostello
Jamon serrano
Kabanos
Kazy / Salchicha de caballo
Kielbasa
Kolbasz
Kranjska klobasa
Kulen
Lardo|SULFITES
Linguica
Linguica calabresa
Lomo canadiense
Longganisa / Salchicha dulce filipina
Longaniza
Longaniza dominicana
Lukanka
Macon
Merguez
Mettwurst
Morcilla
Mortadela|NUTS
Nduja
Njeguski prsut / Jamon ahumado de Njegus
Pancetta
Pancetta de cerdo iberico
Pastirma
Peameal bacon
Pepperoni ahumado
Pepperoni ahumado con jalapenos
Pepperoni desmenuzado
Pepperoni dulce
Pepperoni sin curar
Pepperoni de venado
Prosciutto ahumado
Prosciutto cotto
Prosciutto di Parma
Prosciutto di San Daniele
Red hotdog
Salami calabrese
Salami dulce
Salami duro
Salami napolitano
Salami picante
Salami suave
Salchicha ahumada
Salchicha ahumada calabresa
Salchicha de Frankfurt
Salchicha italiana con hinojo
Salchicha de pollo
Salo
Sarcive
Saucisson
Saucisson piquant
Speck
Spianata piccante
Sobrasada
Soppressata: salami sin curar|SULFITES
Soppressata: salchicha curada|SULFITES
Sucuk / Sujuk|CELERY,MUSTARD,SULFITES
Ventricina
Ventricina ahumado
Wurstel
`),
  SETAS: parseIngredientList(`
Boletus
Champinones al ajillo
Champinones blancos
Champinones cocidos pasteurizados
Champinones de Paris
Champinones grillados
Champinones marinados
Champinones portobello sazonados
Champinones salteados
Champinones shiitake y pleurotus
Champinones castanos
Champinones crimini
Chanterelles
Cordyceps
Enoki
Enoki salteado
Eryngii
Eryngii asado
Hongo de Marayhuaca / Suillus luteus
Hongos negros
Huitlacoche
Hedgehog
Maitake
Maitake asado
Maitake salteado
Matsutake
Melena de leon
Morel
Morel salteado
Nameko
Oreja de madera
Pholiota cultivada
Pioppino / Seta de alamo
Porcini
Portabellini
Portabellini asado
Portobello
Seta coliflor
Seta ostra
Setas salteadas
Shiitake
Shimeji
Shimeji salteado
Tartufi istriani / trufa de istriani
Trompeta negra
Trufa blanca
Trufa negra
`),
  FRUTAS: parseIngredientList(`
Acerola
Ackee
Albaricoque
Albaricoque seco
Arandanos
Arandanos rojos
Bananas
Bananas caramelizadas
Bayas Saskatoon
Carambola
Cerezas
Ciruelas
Coco
Datiles
Datiles en polvo
Durian
Durian musangking
Frambuesas
Fresas
Granada
Granos de granada
Grosella negra
Grosella roja
Guayaba
Kiwi
Lychee
Mandarina
Mango
Mango chutney
Manzana Bramley
Manzana cocida
Maracuya
Melocoton
Melon
Moras
Mosto de uva
Naranja
Nectarina
Papaya
Pera coreana
Pina caramelizada
Pina encurtida
Pina Maui gold
Ruibarbo
Tomate datterino
Tomate pera
Uvas
Uvas pasas|SULFITES
`),
  VERDURAS: parseIngredientList(`
Aceitunas con hueso
Aceitunas kalamata
Aceitunas negras a la griega
Aceitunas negras con hueso
Aceitunas negras confitadas
Aceitunas sazonadas
Aceitunas taggiasche
Aceitunas verdes a la griega
Acelga
Aguacate
Ajo tierno
Alcaparras
Apio|CELERY
Batata
Berenjena asada
Bolas de taro
Brocoli
Brotes de bambu
Calabacin grillado
Calabaza asada
Calabaza moscada
Capsicum
Cebolla amarilla
Cebolla asada
Cebolla caramelizada
Cebolla crujiente
Cebolla encurtida
Cebolla de verdeo
Cebolla deshidratada
Cebolla frita
Cebolla grillada
Cebolla morada de Tropea
Cebolla rehogada
Cebolla roja
Cebolla roja asada
Cebolla roja balsamica
Cebolla roja de Tropea
Cebolla roja encurtida
Cebolla sofrita
Cebolleta
Cebollino
Cebollin frito
Chalote
Chile habanero
Chile peri-peri
Chile rojo
Chile serrano
Chirivia
Choclo
Chucrut
Col blanca
Col de Saboya
Coles de Bruselas
Coliflor
Edamame|SOY
Esparrago triguero
Esparrago verde
Espinaca sazonada
Fefferoni
Friarielli marinado
Friarielli salteado
Fruta del pan
Germinado de lino integral
Germinado de soja|SOY
Germinado de trigo
Germinado de trigo integral
Guisantes
Guisantes dulces
Hojas de taro
Hojas de te fermentadas
Hren
Jalapeno
Jalapeno deshidratado
Jalapenos marinados
Kale / col rizada
Kale / col rizada en polvo
Konjac
Kumara / batata maori
Lechuga
Loroco
Maiz Dulce
Maiz tostado
Nabo
Nabo encurtido
Nabo sueco
Nopales
Okra
Palmito
Patatas
Patatas asadas
Patatas fritas
Patatas paja
Peperoncino
Peperoncino marinado
Peperoni en vinagre
Peperoni encurtidos
Pepinillos
Pepino
Pimiento amarillo asado
Pimiento amarillo grillado
Pimiento peppadew
Pimiento poblano
Pimiento rojo asado
Pimiento rojo marinado
Pimiento rojo seco
Pimiento shishito
Pimiento verde asado
Pimientos al vinagre
Pimientos amarillos marinados
Pimientos flameados
Pimientos picantes marinados
Pimientos del piquillo
Pimientos verdes dulces marinados
Pimientos verdes secos
Puerro
Rabano
Raiz de bardana
Remolacha
Remolacha encurtida
Remolacha frita
Renkon
Renkon encurtido
Renkon salteado
Rocket maldivo
Roquito
Rucula
Scotch bonnet
Shiso / Perilla
Taro
Tomates asados
Tomates cherry
Tomates cherry amarillos semisecos
Tomates cherry del Piennolo del Vesuvio
Tomates cherry semisecos
Tomates deshidratados marinados
Tomates fresco
Tomates San Marzano
Tomates secos
Topinambur
Yaca verde
Zanahoria
`),
  HIERBAS_ESPECIAS: parseIngredientList(`
Achiote
Ajedrea
Ajo deshidratado
Ajo en polvo
Ajo granulado
Ajo negro
Albahaca fresca
Albahaca tailandesa
Albahaca seca
Alcaravea
Anis
Anis estrellado
Apio de monte (levistico)|CELERY
Apio en polvo|CELERY
Azafran
Azahar
Baharat
Bayas rosas
Berbere
Canela
Cardamomo
Cayena
Cebolla en polvo
Cebolla tostada en polvo
Chaat masala
Chile
Chile en hojuelas
Chile en polvo
Chile pimiento
Chipotle en polvo
Cilantro
Cilantro picado
Clavo de olor
Comino
Coriandro
Curcuma
Curry
Dukkah|NUTS
Enebro
Eneldo
Estragon frances
Estragon ruso
Fenogreco
Furikake|FISH,SESAME,SOY
Garam masala
Gochugaru
Hawaij
Hierba luisa / Lemongrass
Hierbas provenzales
Hinojo
Hojas de curry
Jalapeno en polvo
Jengibre
Laurel
Lemon myrtle
Macis
Mejorana
Menta
Menta dulce
Merken
Mostaza en polvo|MUSTARD
Mostaza negra|MUSTARD
Nuez moscada
Oregano seco
Papalo
Peperoncino en polvo
Perejil
Perejil seco
Pimenton
Pimenton ahumado
Pimenton picante / Paprika
Pimenton picante / Paprika Ahumado
Pimienta blanca
Pimienta cayena
Pimienta de Jamaica
Pimienta negra
Pimienta de Sichuan
Puerro en polvo
Ras el hanout
Romero
Romero seco
Sal ahumada
Sal de ajo
Sal de cebolla
Salvia
Semillas de cilantro
Serpol
Shichimi togarashi|SESAME
Sumac
Tamarindo en polvo
Tomate Bush
Tomillo
Tomillo seco
Za'atar|SESAME
Zumo de lima concentrado
Zumo de limon concentrado
`),
  PROTEINA_VEGANA: parseIngredientList(`
Atun vegano|SOY
Chorizo vegetal
Falafel|GLUTEN
Jackfruit BBQ
Jackfruit estilo pulled pork
Jackfruit pepperoni
Jamon vegano
Natto|SOY
Pepperoni de zanahoria
Pepperoni vegetal
Pepperoni vegetal de guisantes|SOY
Proteina de garbanzo
Proteina de guisante
Salami vegano
Salchicha italiana vegetal
Seitan|GLUTEN
Seitan ahumado|GLUTEN
Seitan estilo shawarma|GLUTEN
Soja texturizada|SOY
Tempeh|SOY
Tempeh ahumado|SOY
Tofu|SOY
Tofu ahumado|SOY
Tofu apestoso|SOY
Tofu de garbanzo birmano
`),
  AROMAS_Y_EXTRACTOS: parseIngredientList(`
Agua de azahar
Agua de rosas
Aroma de setas
Extracto de ajo
Extracto de cebolla
Extracto de chile
Extracto de jengibre
Extracto de levistico
Extracto de malta de cebada|GLUTEN
Extracto de oregano
Extracto de paprika
Extracto de pimenton
Extracto de pimienta blanca
Extracto de romero
Extracto de tomillo
Extracto de vainilla
Humo de madera de haya
Humo natural
`),
  FRUTOS_SECOS_Y_SEMILLAS: parseIngredientList(`
Almendra|NUTS
Altramuz|LUPIN
Anacardos|NUTS
Avellana|NUTS
Avellanas tostadas|NUTS
Cacahuete / mani|PEANUT
Nuez|NUTS
Nuez de macadamia|NUTS
Pecana|NUTS
Pinones|NUTS
Pistacho de Antep|NUTS
Semillas de acacias tostadas / Wattleseed
Semillas de calabaza
Semillas de quinoa roja
Semillas de alcaravea
Semillas de comino
Semillas de hinojo
Semillas de mostaza|MUSTARD
Semillas de sesamo|SESAME
Semilla de mijo
Semillas de amapola
Semillas de chia
Semillas de girasol
Semillas de lino
Semillas de lino integral
Sesamo tostado|SESAME
`),
  ENDULZANTES: parseIngredientList(`
Azucar caramelizado
Azucar de cana
Azucar de remolacha
Azucar demerara
Azucar glas
Azucar mascabado
Azucar moreno
Creme de marrons / Crema de castanas
Dextrosa
Golden syrup
Melaza
Miel de acacia
Sirope de arce
Sirope de arroz en polvo
Sirope de azucar invertido
Sirope de caramelo
Sirope de datil
Sirope de glucosa
Sirope de glucosa polvo
Sirope de maiz
Stroop
`),
  SALSAS_CREMAS: parseIngredientList(`
Aderezo de crema agria|MILK
Adjika
Ajvar
Alfredo|MILK
Alioli|EGG
Bagoong|SHELLFISH
Bechamel|MILK,GLUTEN
Bigilla / Pasta de habas maltesa
Chikanda
Chimichurri
Chipotle
Chutney
Crema de arroz basmati al curry
Crema de aji amarillo
Crema de calabacin
Crema fresca|MILK
Crema de huancaina|MILK
Crema de leche|MILK
Crema de miso
Crema de rocoto|MILK
Crema de trufa
Crema dulce de miso|SOY,MILK,WHEAT
Creme Fraiche|MILK
Coulis de tomate
Curry massaman
Curry verde
Doenjang mayo|EGG,SOY
Epityrum
Ezme
Garum|FISH
Guacamole
Guasacaca
Glaseado balsamico
Harissa
Hogao
Ketchup
Kumis|MILK
Lyutenitsa
Mango habanero BBQ
Mayonesa|EGG
Mayonesa japonesa|EGG
Miel-mostaza|MUSTARD
Miel picante
Miso dulce gratinado
Miso de garbanzo
Nga pi / Pasta de pescado fermentado|FISH
Molokhia
Mostaza
Mostaza a la antigua|MUSTARD
Mostaza Dijon|MUSTARD
Mostaza inglesa|MUSTARD
Muhammara|NUTS
Pebre
Pesto de albahaca|NUTS
Pesto de pistacho|NUTS
Pesto rojo|NUTS
Picante
Pico de gallo
Pure de calabaza
Pure de chile
Pure de chile rojo
Pure de ciruela picante
Pure de kawakawa
Pure de pimiento picante
Ranch|MILK,EGG
Reduccion de uva
Relish de jalapeno encurtido
Rihaakuru|FISH
Rougaille
Sahawiq
Salsa de abulon|SHELLFISH
Salsa Alabama blanca
Salsa de alcaparras
Salsa arrabiata|MILK
Salsa de batata
Salsa de bearnesa|MILK,EGG
Salsa brava|MILK
Salsa buffalo|MILK
Salsa de cacahuate|PEANUT
Salsa de ciruela
Salsa de champinones|MILK
Salsa cheddar|MILK
Salsa de chile guaque
Salsa de chipotle|MILK
Salsa cremosa de ajo asado|MILK
Salsa curry|GLUTEN,MUSTARD
Salsa datil
Salsa donair
Salsa gravy
Salsa griot
Salsa gochujang|SESAME,SOY,WHEAT
Salsa golf|EGG
Salsa hoisin|SESAME,SOY,WHEAT
Salsa holandesa|EGG,MILK
Salsa de hueso
Salsa K-Ssamjang|SOY
Salsa laksa|FISH,GLUTEN
Salsa jerk
Salsa de miel BBQ|MILK
Salsa nai miris
Salsa de paprika
Salsa peri-peri
Salsa de pimiento
Salsa de pescado caramelizada|FISH
Salsa putanesca
Salsa de queso|MILK
Salsa de rabano
Salsa de ricotta|MILK
Salsa romesco
Salsa de soja|SOY
Salsa macha
Salsa makhani|MILK
Salsa mantequilla|MILK
Salsa marinera
Salsa mascarpone|MILK
Salsa de menta
Salsa de ostras|SHELLFISH
Salsa picante de pina
Salsa piri piri
Salsa de rabo de buey
Salsa rendang|COCONUT
Salsa roja mexicana
Salsa roquefort|MILK
Salsa de te tailandes|MILK
Salsa satay
Salsa sichuan|MILK
Salsa shito
Salsa de tamarindo
Salsa tikka masala|MILK
Salsa de tomatillo / verde mexicana
Salsa Tum
Salsa vindaloo
Salsa vodka
Salsa de yogurt|MILK
Sambal oelek
Sambal udang|SHELLFISH
Shubat|MILK
Smetana / Crema agria|MILK
Sriracha
Suya|PEANUT
Tahini|SESAME
Tamari|SOY
Tapenade
Tapenade de champinones
Tapenade de trufa
Teriyaki|SOY,SESAME,WHEAT
Tinta de calamar|SHELLFISH
Tkemali
Tom yum|FISH
Toum|EGG
Tzatziki|MILK
Vinaza roja
Wasabi
`),
  ACEITES_GRASAS_VINAGRES: parseIngredientList(`
Aceite de albahaca
Aceite de arroz
Aceite de ajo
Aceite de canola
Aceite de canola alto oleico
Aceite de canola y oliva
Aceite de cartamo
Aceite de cebolleta
Aceite de chile
Aceite de coco
Aceite de colza
Aceite de colza hidrogenado
Aceite de girasol
Aceite de girasol alto oleico
Aceite de hierbas provenzales
Aceite de maiz
Aceite de naranja
Aceite de oliva virgen
Aceite de oliva virgen extra
Aceite de orujo de oliva
Aceite de palma
Aceite de perejil y colza
Aceite de salvado de arroz
Aceite de semilla de algodon
Aceite de sesamo|SESAME
Aceite de soja|SOY
Aceite de trufa
Aceite vegetal
Ghee|MILK
Grasa de cerdo
Grasa de karite
Grasa de pollo
Grasa de vacuno
Mantequilla|MILK
Mantequilla de ajo|MILK
Vinagre
Vinagre balsamico
Vinagre balsamico blanco|SULFITES
Vinagre balsamico de Modena|SULFITES
Vinagre de alcohol
Vinagre de arroz
Vinagre de brandy
Vinagre de coco
Vinagre de frutas
Vinagre de jerez
Vinagre de malta|GLUTEN
Vinagre de manzana
Vinagre de vino blanco|SULFITES
Vinagre de vino tinto|SULFITES
Vinagre destilado
Vinagre en polvo
Vinagreta brasilena
`),
  TOPPINGS_DULCES: parseIngredientList(`
Bocadillo de guayaba
Chebakia|SESAME,GLUTEN
Chocolate negro
Cajeta / dulce de leche de cabra|MILK
Crema de avellanas|NUTS
Crema de cacahuete|PEANUT
Crema Speculoos / Biscoff
Crema de gianduja|MILK,NUTS
Crema de mascarpone|MILK
Crema de pistacho|MILK,NUTS
Dulce de Leche|MILK
Halva
Malvavisco
Manteca de cacao
Mantequilla de manzana
Marshmallow|GELATIN
Mermelada de fresa
Mermelada de frutos rojos
Mermelada de mora
Mermelada / compota de grosella
Mermelada de tocino
Melaza de granada
Mochi
Mousse de batata
Omani halwa
Ricotta dulce|MILK
Te matcha
`),
  OTROS: parseIngredientList(`
Algas nori
Algas wakame
Alubias blancas
Alubias cannellini
Alubias rojas
Arroz
Arroz integral germinado
Atun carpaccio
Avena|GLUTEN
Cacao sin azucar
Camaron sakura|SHELLFISH
Casabe
Chapulines / grillos tostados
Chile crispy|SESAME,SOY
Cigarras
Clara de huevo|EGG
Clara de huevo deshidratada|EGG
Coco rallado
Coco rallado tostado
Concentrado de champinones
Concentrado de remolacha
Concentrado de tomate
Copos de coco
Copos de patata
Copos de soja|SOY
Couscous|GLUTEN
Ensalada de col
Faina / Tortilla de garbanzos
Fecula de maiz
Fecula de mandioca
Fibra de achicoria
Fibra de bambu
Fibra de lino
Fibra de trigo|GLUTEN
Fideos de arroz
Frijoles negros fermentados
Garbanzo
Gelatina
Gelatina de cerdo
Guisantes de ojo negro
Gusanos mopani
Huevo de codorniz|EGG
Huevo frito|EGG
Huevo milenario|EGG
Huevo en polvo|EGG
Huevo entero deshidratado|EGG
Injera
Jengibre encurtido
Judias rojas
Jugo de pasas
Leche de coco
Leche de patata
Leche desnatada en polvo|MILK
Leche entera en polvo|MILK
Linaza
Linaza dorada
Linaza molida
Marsala
Nachos
Nata doble|MILKº
Oporto rojo|SULFITES
Pan de pita|GLUTEN
Pan rallado|GLUTEN
Panko|GLUTEN
Papadum triturado|GLUTEN
Pasta de anchoas
Pescado blanco en polvo|FISH
Piel de naranja confitada
Popcorn / Palomitas de maiz
Psyllium
Pure de cebolla
Pure de ciruela dulce
Pure de coliflor
Pure de jengibre
Pure de lima
Pure de patata
Queso crema de ajo|MILK
Ralladura de limon
Rusk|GLUTEN
Sal de camargue
Sal de guerande
Salted egg / Huevo de pato salado
Shiratama
Suero de leche en polvo|MILK
Tempura|EGG,GLUTEN
Tteok
Vegemite
Yema de huevo|EGG
Yema de huevo en polvo|EGG
`),
};

const INGREDIENTS_BASE = mergeIngredientBases(
  INGREDIENTS_LEGACY_BASE,
  INGREDIENTS_EXTENDED_BASE
);

const SEMANTIC_LOCALES = ["es", "en", "it", "fr", "pt", "ar", "zh"];
const CORE_REVIEW_LOCALES = ["es", "en"];
const SEMANTIC_STATUSES = ["UNREVIEWED", "NEEDS_REVIEW", "REVIEWED", "REJECTED"];
const SEMANTIC_AUDIT_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "REVIEWED", label: "Reviewed" },
  { key: "NEEDS_REVIEW", label: "Needs review" },
  { key: "UNREVIEWED", label: "Unreviewed" },
  { key: "MISSING_KEY", label: "Missing key" },
  { key: "MISSING_CATEGORY", label: "Missing category" },
  { key: "MISSING_TRANSLATIONS", label: "Missing i18n" },
];
const LEGACY_TO_SEMANTIC_CATEGORY_KEY = {
  ACEITES_GRASAS_VINAGRES: "oils_fats_vinegars",
  AROMAS_Y_EXTRACTOS: "other",
  CARNES: "meats",
  CREMAS_DULCES: "sweet_creams",
  EMBUTIDOS: "cured_meats",
  ENDULZANTES: "sweeteners",
  EXTRAS: "extras",
  FRUTAS: "fruits",
  FRUTOS_SECOS_Y_SEMILLAS: "nuts_seeds",
  HIERBAS_ESPECIAS: "herbs_spices",
  OTROS: "other",
  PESCADOS_Y_MARISCOS: "seafood",
  PROTEINA_VEGANA: "vegan_protein",
  QUESOS: "cheeses",
  SALSAS: "sauces",
  SETAS: "mushrooms",
  VERDURAS: "vegetables",
};

const buildEmptyTranslations = () =>
  SEMANTIC_LOCALES.map((locale) => ({
    locale,
    name: "",
    description: "",
    isReviewed: false,
  }));

const buildSemanticDraft = (ingredient = {}) => ({
  canonicalKey: ingredient.canonicalKey || "",
  semanticStatus: ingredient.semanticStatus || "UNREVIEWED",
  semanticCategoryId: ingredient.semanticCategoryId || "",
  translations: buildEmptyTranslations(),
  aliasesText: "",
});

const mergeSemanticTranslations = (translations = []) => {
  const byLocale = new Map(
    translations.map((translation) => [translation.locale, translation])
  );

  return buildEmptyTranslations().map((empty) => ({
    ...empty,
    ...(byLocale.get(empty.locale) || {}),
  }));
};

const formatAliasLines = (aliases = []) =>
  aliases
    .map((alias) =>
      [
        alias.alias,
        alias.locale || "",
        alias.country || "",
        alias.displayable ? "display" : "",
      ]
        .filter(Boolean)
        .join(" | ")
    )
    .join("\n");

const parseAliasLines = (value) =>
  String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [alias, locale = "", country = "", mode = ""] = line
        .split("|")
        .map((part) => part.trim());

      return {
        alias,
        locale: locale || null,
        country: country || null,
        searchable: true,
        displayable: mode.toLowerCase() === "display",
        isReviewed: true,
        source: "MANUAL",
      };
    });

const getIngredientSemanticStatus = (ingredient = {}) =>
  ingredient.semanticStatus || "UNREVIEWED";

const getSemanticStatusClass = (status) =>
  `status-${String(status || "UNREVIEWED").toLowerCase().replace(/_/g, "-")}`;

const formatSemanticStatus = (status) =>
  String(status || "UNREVIEWED").toLowerCase().replace(/_/g, " ");

const buildCanonicalKeySuggestion = (name) =>
  normalizeIngredientKey(name)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const getReviewedTranslationLocales = (translations = []) =>
  new Set(
    translations
      .filter(
        (translation) =>
          translation.isReviewed === true &&
          String(translation.name || "").trim()
      )
      .map((translation) => translation.locale)
  );

const getSemanticDraftValidation = (draft = {}) => {
  const reviewedLocales = getReviewedTranslationLocales(draft.translations || []);
  const missingCoreLocales = CORE_REVIEW_LOCALES.filter(
    (locale) => !reviewedLocales.has(locale)
  );
  const missingLocales = SEMANTIC_LOCALES.filter(
    (locale) => !reviewedLocales.has(locale)
  );
  const warnings = [];
  const criticalIssues = [];

  if (!String(draft.canonicalKey || "").trim()) {
    warnings.push("Missing global identity key");
  }

  if (!draft.semanticCategoryId) {
    warnings.push("Missing semantic category");
  }

  if (missingCoreLocales.length > 0) {
    warnings.push(
      "Missing reviewed core names: " +
        missingCoreLocales.map((locale) => locale.toUpperCase()).join(", ")
    );
  }

  if (missingLocales.length > CORE_REVIEW_LOCALES.length) {
    warnings.push(
      "Incomplete language coverage: " +
        missingLocales.map((locale) => locale.toUpperCase()).join(", ")
    );
  }

  if (String(draft.aliasesText || "").trim() === "") {
    warnings.push("No searchable aliases yet");
  }

  if (draft.semanticStatus === "REVIEWED") {
    if (!String(draft.canonicalKey || "").trim()) {
      criticalIssues.push("REVIEWED requires a global identity key");
    }

    if (!draft.semanticCategoryId) {
      criticalIssues.push("REVIEWED requires a semantic category");
    }

    if (missingCoreLocales.length > 0) {
      criticalIssues.push(
        "REVIEWED requires reviewed names in " +
          missingCoreLocales.map((locale) => locale.toUpperCase()).join(" and ")
      );
    }
  }

  return { criticalIssues, warnings, missingCoreLocales, missingLocales };
};

const getIngredientMissingLocales = (ingredient = {}) => {
  const translations = Array.isArray(ingredient.semanticTranslations)
    ? ingredient.semanticTranslations
    : [];

  return SEMANTIC_LOCALES.filter(
    (locale) =>
      !translations.some(
        (translation) =>
          translation.locale === locale &&
          translation.isReviewed === true &&
          String(translation.name || "").trim()
      )
  );
};

const getIngredientSemanticGaps = (ingredient = {}) => {
  const gaps = [];
  const missingLocales = getIngredientMissingLocales(ingredient);

  if (!String(ingredient.canonicalKey || "").trim()) {
    gaps.push({ key: "key", label: "Key", title: "Missing global identity" });
  }

  if (!ingredient.semanticCategoryId) {
    gaps.push({ key: "category", label: "Cat", title: "Missing semantic category" });
  }

  if (missingLocales.length > 0) {
    const visibleLocales = missingLocales.slice(0, 3).map((locale) => locale.toUpperCase());
    const overflow = missingLocales.length > 3 ? ` +${missingLocales.length - 3}` : "";

    gaps.push({
      key: "i18n",
      label: `I18N ${visibleLocales.join("/").trim()}${overflow}`,
      title: `Missing reviewed translations: ${missingLocales
        .map((locale) => locale.toUpperCase())
        .join(", ")}`,
    });
  }

  return gaps;
};

const getIngredientSemanticPriority = (ingredient = {}) => {
  if (!String(ingredient.canonicalKey || "").trim()) return 10;
  if (!ingredient.semanticCategoryId) return 20;
  if (getIngredientMissingLocales(ingredient).length > 0) return 30;
  if (getIngredientSemanticStatus(ingredient) === "NEEDS_REVIEW") return 40;
  if (getIngredientSemanticStatus(ingredient) === "UNREVIEWED") return 50;
  if (getIngredientSemanticStatus(ingredient) === "REJECTED") return 60;
  return 100;
};

export default function IngredientsModule() {
  const [ingredients, setIngredients] = useState([]);
  const [category, setCategory] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [semanticCategories, setSemanticCategories] = useState([]);
  const [semanticAvailable, setSemanticAvailable] = useState(null);
  const [semanticError, setSemanticError] = useState("");
  const [semanticIngredient, setSemanticIngredient] = useState(null);
  const [semanticDraft, setSemanticDraft] = useState(buildSemanticDraft());
  const [semanticLoading, setSemanticLoading] = useState(false);
  const [semanticSaving, setSemanticSaving] = useState(false);
  const [semanticAuditFilter, setSemanticAuditFilter] = useState("ALL");

const getDisplayName = (name) => (name || "").toUpperCase();
const normalizeIngredientName = (name) =>
  normalizeIngredientKey(name);

const loadIngredients = async () => {
    try {
      setLoading(true);
      const res = await api.get("/ingredients");
      const nextIngredients = Array.isArray(res.data) ? res.data : [];
      setIngredients(nextIngredients);
      return nextIngredients;
    } catch (err) {
      console.error(err);
      return [];
    } finally {
      setLoading(false);
    }
};
const loadSuggestions = async () => {
  try {
    setLoadingSuggestions(true);
    const res = await api.get("/ingredients/suggestions?status=PENDING");
    setSuggestions(Array.isArray(res.data) ? res.data : []);
  } catch (err) {
    console.error(err);
  } finally {
    setLoadingSuggestions(false);
  }
};

const loadSemanticCategories = async () => {
  try {
    const res = await api.get("/ingredients/semantic-categories");
    setSemanticCategories(Array.isArray(res.data) ? res.data : []);
    setSemanticAvailable(true);
    setSemanticError("");
  } catch (err) {
    if (err?.response?.status === 409) {
      setSemanticAvailable(false);
      setSemanticError("Semantic migration pending");
      return;
    }

    console.error(err);
    setSemanticAvailable(false);
    setSemanticError("Semantic API unavailable");
  }
};

useEffect(() => {
  loadIngredients();
  loadSuggestions();
  loadSemanticCategories();
}, []);

const handleCreate = async () => {
    if (!category || !selectedName) return;

    const selected = INGREDIENTS_BASE[category].find(
      (i) => i.name === selectedName
    );

    if (!selected) return;

    try {
      await api.post("/ingredients", {
          name: selected.name,
          category: getCanonicalCategory(category),
          allergens: selected.allergens,
      });

      setSelectedName("");
      loadIngredients();
    } catch (err) {
      console.error(err);
    }
};
const handleApprove = async (id) => {
  try {
    await api.patch(`/ingredients/suggestions/${id}/approve`);

    loadSuggestions();
  } catch (err) {
    console.error(err);
  }
};
const handleReject = async (id) => {
  try {
    await api.patch(`/ingredients/suggestions/${id}/reject`);

    loadSuggestions();
  } catch (err) {
    console.error(err);
  }
};

const handleDeleteIngredient = async (id, name) => {
  const confirmed = window.confirm(
    `Delete ${getDisplayName(name)} from the ingredients table?`
  );

  if (!confirmed) return;

  try {
    await api.delete(`/ingredients/${id}`);

    loadIngredients();
  } catch (err) {
    console.error(err);
  }
};

const openSemanticEditor = async (ingredient) => {
  const ingredientId = ingredient?.idValue || ingredient?.ingredientId || ingredient?.id;

  if (!ingredientId) return;

  setSemanticIngredient(ingredient);
  setSemanticDraft(buildSemanticDraft(ingredient));
  setSemanticLoading(true);
  setSemanticError("");

  try {
    const res = await api.get(`/ingredients/${ingredientId}/semantics`);
    const data = res.data || {};
    setSemanticAvailable(true);
    setSemanticDraft({
      canonicalKey: data.canonicalKey || "",
      semanticStatus: data.semanticStatus || "UNREVIEWED",
      semanticCategoryId: data.semanticCategoryId || "",
      translations: mergeSemanticTranslations(data.translations || []),
      aliasesText: formatAliasLines(data.aliases || []),
    });
  } catch (err) {
    if (err?.response?.status === 409) {
      setSemanticAvailable(false);
      setSemanticError("Semantic migration pending");
      return;
    }

    console.error(err);
    setSemanticError("Could not load semantic data");
  } finally {
    setSemanticLoading(false);
  }
};

const closeSemanticEditor = () => {
  setSemanticIngredient(null);
  setSemanticDraft(buildSemanticDraft());
  setSemanticLoading(false);
  setSemanticSaving(false);
};

const updateTranslationDraft = (locale, field, value) => {
  setSemanticDraft((current) => ({
    ...current,
    translations: current.translations.map((translation) =>
      translation.locale === locale
        ? { ...translation, [field]: value }
        : translation
    ),
  }));
};

const applySuggestedCanonicalKey = () => {
  if (!semanticIngredient) return;

  const suggestedKey = buildCanonicalKeySuggestion(semanticIngredient.name);

  if (!suggestedKey) return;

  setSemanticDraft((current) => ({
    ...current,
    canonicalKey: suggestedKey,
  }));
};

const applySuggestedSemanticCategory = () => {
  if (!semanticIngredient) return;

  const legacyCategory = getCanonicalCategory(semanticIngredient.category);
  const semanticCategoryKey = LEGACY_TO_SEMANTIC_CATEGORY_KEY[legacyCategory];
  const semanticCategory = semanticCategories.find(
    (item) => item.canonicalKey === semanticCategoryKey
  );

  if (!semanticCategory) return;

  setSemanticDraft((current) => ({
    ...current,
    semanticCategoryId: semanticCategory.id,
  }));
};

const fillSpanishTranslationFromLegacyName = () => {
  if (!semanticIngredient) return;

  setSemanticDraft((current) => ({
    ...current,
    translations: current.translations.map((translation) =>
      translation.locale === "es"
        ? {
            ...translation,
            name: translation.name || semanticIngredient.name || "",
            isReviewed: Boolean(translation.name || semanticIngredient.name),
          }
        : translation
    ),
  }));
};

const markNamedTranslationsReviewed = () => {
  setSemanticDraft((current) => ({
    ...current,
    translations: current.translations.map((translation) => ({
      ...translation,
      isReviewed: String(translation.name || "").trim()
        ? true
        : translation.isReviewed,
    })),
  }));
};

const addAliasesFromTranslations = () => {
  if (!semanticIngredient) return;

  setSemanticDraft((current) => {
    const existingAliases = parseAliasLines(current.aliasesText);
    const aliasKey = (alias) =>
      [
        normalizeIngredientName(alias.alias),
        String(alias.locale || "").toLowerCase(),
        String(alias.country || "").toUpperCase(),
      ].join("|");
    const seen = new Set(existingAliases.map(aliasKey));
    const nextAliases = [...existingAliases];

    const pushAlias = (alias) => {
      const normalizedAlias = String(alias.alias || "").trim();

      if (!normalizedAlias) return;

      const item = {
        alias: normalizedAlias,
        locale: alias.locale || null,
        country: alias.country || null,
        searchable: true,
        displayable: false,
        isReviewed: true,
        source: "MANUAL",
      };
      const key = aliasKey(item);

      if (seen.has(key)) return;

      seen.add(key);
      nextAliases.push(item);
    };

    pushAlias({ alias: semanticIngredient.name, locale: "es" });
    current.translations.forEach((translation) => {
      pushAlias({
        alias: translation.name,
        locale: translation.locale,
      });
    });

    return {
      ...current,
      aliasesText: formatAliasLines(nextAliases),
    };
  });
};

const saveSemanticEditor = async ({ advance = false } = {}) => {
  if (!semanticIngredient || !semanticAvailable) return;

  const ingredientId =
    semanticIngredient.idValue ||
    semanticIngredient.ingredientId ||
    semanticIngredient.id;

  if (!ingredientId) return;

  const draftValidation = getSemanticDraftValidation(semanticDraft);

  if (draftValidation.criticalIssues.length > 0) {
    setSemanticError(draftValidation.criticalIssues[0]);
    return;
  }

  const translations = semanticDraft.translations
    .map((translation) => ({
      ...translation,
      name: String(translation.name || "").trim(),
      description: String(translation.description || "").trim(),
    }))
    .filter((translation) => translation.name);
  const nextAfterCurrent = advance
    ? semanticWorkQueue.find(
        (ingredient) => Number(ingredient.id) !== Number(ingredientId)
      )
    : null;

  try {
    setSemanticSaving(true);
    await api.patch(`/ingredients/${ingredientId}/semantics`, {
      canonicalKey: semanticDraft.canonicalKey,
      semanticStatus: semanticDraft.semanticStatus,
      semanticCategoryId: semanticDraft.semanticCategoryId || null,
      translations,
      aliases: parseAliasLines(semanticDraft.aliasesText),
    });

    const updatedIngredients = await loadIngredients();

    if (advance && nextAfterCurrent) {
      const nextIngredient =
        updatedIngredients.find(
          (ingredient) => Number(ingredient.id) === Number(nextAfterCurrent.id)
        ) || nextAfterCurrent;

      await openSemanticEditor(nextIngredient);
      return;
    }

    closeSemanticEditor();
  } catch (err) {
    console.error(err);
    setSemanticError(
      err?.response?.data?.error || "Could not save semantic data"
    );
  } finally {
    setSemanticSaving(false);
  }
};

const existingIngredientNames = new Set(
  ingredients.map((ing) => normalizeIngredientName(ing.name))
);

const availableBaseIngredients = category
  ? INGREDIENTS_BASE[category].filter(
      (item) =>
        !existingIngredientNames.has(
          normalizeIngredientName(item.name)
        )
    ).sort((a, b) =>
      getDisplayName(a.name).localeCompare(getDisplayName(b.name), "es", {
        sensitivity: "base",
      })
    )
  : [];

const semanticAudit = ingredients.reduce(
  (acc, ingredient) => {
    const status = getIngredientSemanticStatus(ingredient);
    const translations = Array.isArray(ingredient.semanticTranslations)
      ? ingredient.semanticTranslations
      : [];
    const missingLocales = getIngredientMissingLocales(ingredient);

    acc.total += 1;
    acc.statuses[status] = (acc.statuses[status] || 0) + 1;
    acc.translationCount += Number(ingredient.translationCount || translations.length || 0);
    acc.aliasCount += Number(
      ingredient.aliasCount ||
        (Array.isArray(ingredient.semanticAliases)
          ? ingredient.semanticAliases.length
          : 0)
    );

    if (!String(ingredient.canonicalKey || "").trim()) acc.missingKey += 1;
    if (!ingredient.semanticCategoryId) acc.missingCategory += 1;
    if (missingLocales.length > 0) acc.missingTranslations += 1;

    SEMANTIC_LOCALES.forEach((locale) => {
      const hasReviewedTranslation = translations.some(
        (translation) =>
          translation.locale === locale &&
          translation.isReviewed === true &&
          String(translation.name || "").trim()
      );

      if (hasReviewedTranslation) acc.localeCoverage[locale] += 1;
    });

    return acc;
  },
  {
    total: 0,
    statuses: {
      REVIEWED: 0,
      NEEDS_REVIEW: 0,
      UNREVIEWED: 0,
      REJECTED: 0,
    },
    missingKey: 0,
    missingCategory: 0,
    missingTranslations: 0,
    translationCount: 0,
    aliasCount: 0,
    localeCoverage: SEMANTIC_LOCALES.reduce((acc, locale) => {
      acc[locale] = 0;
      return acc;
    }, {}),
  }
);

const semanticReviewedPercent = semanticAudit.total
  ? Math.round((semanticAudit.statuses.REVIEWED / semanticAudit.total) * 100)
  : 0;

const ingredientMatchesAuditFilter = (ingredient) => {
  const status = getIngredientSemanticStatus(ingredient);

  if (semanticAuditFilter === "ALL") return true;
  if (semanticAuditFilter === "MISSING_KEY") {
    return !String(ingredient.canonicalKey || "").trim();
  }
  if (semanticAuditFilter === "MISSING_CATEGORY") {
    return !ingredient.semanticCategoryId;
  }
  if (semanticAuditFilter === "MISSING_TRANSLATIONS") {
    return getIngredientMissingLocales(ingredient).length > 0;
  }

  return status === semanticAuditFilter;
};

const filteredIngredients = ingredients.filter(ingredientMatchesAuditFilter);
const semanticWorkQueue = filteredIngredients
  .filter((ingredient) => getIngredientSemanticPriority(ingredient) < 100)
  .sort((a, b) => {
    const priorityDiff =
      getIngredientSemanticPriority(a) - getIngredientSemanticPriority(b);

    if (priorityDiff !== 0) return priorityDiff;

    return String(a.name || "").localeCompare(String(b.name || ""), "es", {
      sensitivity: "base",
    });
  });
const nextSemanticIssue = semanticWorkQueue[0] || null;
const semanticDraftValidation = getSemanticDraftValidation(semanticDraft);
const semanticSaveBlocked = semanticDraftValidation.criticalIssues.length > 0;

const treeCategories = Object.keys(INGREDIENTS_BASE).reduce((acc, baseCategory) => {
  acc[baseCategory] = [];
  return acc;
}, {});

filteredIngredients.forEach((ing) => {
  const canonicalCategory = getCanonicalCategory(ing.category);
  if (!treeCategories[canonicalCategory]) treeCategories[canonicalCategory] = [];
  treeCategories[canonicalCategory].push(ing);
});

const treeData = Object.entries(treeCategories)
  .sort(([a], [b]) =>
    a.localeCompare(b, "es", { sensitivity: "base" })
  ).map(([category, items]) => ({
    id: `cat-${category}`, // 🔥 ID SEGURO
    name: category,
    children: items
    .sort((a, b) =>
        a.name.localeCompare(b.name, "es", { sensitivity: "base" })
      )
      .map((i) => ({
        id: `ing-${i.id}`, // 🔥 ID SEGURO
        idValue: i.id,
        ingredientId: i.id,
        name: i.name,
        category: i.category,
        canonicalKey: i.canonicalKey || "",
        semanticStatus: i.semanticStatus || "UNREVIEWED",
        semanticCategoryId: i.semanticCategoryId || "",
        translationCount: i.translationCount || 0,
        aliasCount: i.aliasCount || 0,
        semanticTranslations: i.semanticTranslations || [],
        semanticAliases: i.semanticAliases || [],
        semanticGaps: getIngredientSemanticGaps(i),
        allergens: i.allergens || [],
      })),
  }));

  return (
    <div>
      {/* FORM */}
      <div style={{ marginBottom: 20 }}>
        {/* CATEGORY */}
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setSelectedName("");
          }}
        >
          <option value="">Select category</option>
          {Object.keys(INGREDIENTS_BASE).map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        {/* INGREDIENT */}
        <select
          value={selectedName}
          onChange={(e) => setSelectedName(e.target.value)}
          style={{ marginLeft: 10 }}
          disabled={!category}
        >
          <option value="">Select ingredient</option>
          {category &&
            availableBaseIngredients.map((item) => (
              <option key={item.name} value={item.name}>
                {getDisplayName(item.name)}
              </option>
            ))}
        </select>

        <button onClick={handleCreate} style={{ marginLeft: 10 }}>
          + Create
        </button>
      </div>

      <h2>Ingredients</h2>
      <section className="gm-semanticAudit" aria-label="Semantic audit">
        <div className="gm-auditHeader">
          <div>
            <span>Semantic audit</span>
            <strong>
              {semanticAudit.statuses.REVIEWED}/{semanticAudit.total} reviewed
            </strong>
          </div>
          <div className="gm-auditProgress" aria-hidden="true">
            <span style={{ width: `${semanticReviewedPercent}%` }} />
          </div>
        </div>

        <div className="gm-auditMetrics">
          {SEMANTIC_AUDIT_FILTERS.map((filter) => {
            const value =
              filter.key === "ALL"
                ? semanticAudit.total
                : filter.key === "MISSING_KEY"
                  ? semanticAudit.missingKey
                : filter.key === "MISSING_CATEGORY"
                  ? semanticAudit.missingCategory
                  : filter.key === "MISSING_TRANSLATIONS"
                    ? semanticAudit.missingTranslations
                    : semanticAudit.statuses[filter.key] || 0;

            return (
              <button
                key={filter.key}
                type="button"
                className={`gm-auditCard ${
                  semanticAuditFilter === filter.key ? "is-active" : ""
                }`}
                onClick={() => setSemanticAuditFilter(filter.key)}
              >
                <span>{filter.label}</span>
                <strong>{value}</strong>
              </button>
            );
          })}
        </div>

        <div className="gm-auditSecondary">
          <span>{filteredIngredients.length}/{semanticAudit.total} showing</span>
          <span>{semanticWorkQueue.length} actionable</span>
          <span>{semanticAudit.translationCount} translations</span>
          <span>{semanticAudit.aliasCount} aliases</span>
          {semanticAvailable === false && (
            <span className="gm-auditWarning">{semanticError}</span>
          )}
        </div>

        <div className="gm-auditWorkQueue">
          <button
            type="button"
            className="gm-auditAction"
            disabled={!nextSemanticIssue || semanticAvailable === false}
            onClick={() => openSemanticEditor(nextSemanticIssue)}
          >
            Open next issue
          </button>
          <span>
            {nextSemanticIssue
              ? `${getDisplayName(nextSemanticIssue.name)} · ${getIngredientSemanticGaps(
                  nextSemanticIssue
                )
                  .map((gap) => gap.label)
                  .join(", ")}`
              : "No actionable semantic issues in this view"}
          </span>
        </div>

        <div className="gm-localeCoverage">
          {SEMANTIC_LOCALES.map((locale) => (
            <span key={locale}>
              <strong>{locale.toUpperCase()}</strong>
              {semanticAudit.localeCoverage[locale]}/{semanticAudit.total}
            </span>
          ))}
        </div>
      </section>
      {/* 🔥 SUGGESTIONS */}
<div
  style={{
    marginBottom: 20,
    padding: 10,
    border: "1px solid #444",
    borderRadius: 8,
    background: "#111",
  }}
>
  <strong>Suggestions</strong>

  {loadingSuggestions && <p>Loading...</p>}

  {!loadingSuggestions && suggestions.length === 0 && (
    <p style={{ opacity: 0.6 }}>No pending</p>
  )}

  {suggestions.map((s) => (
    <div
      key={s.id}
      style={{
        display: "flex",
        justifyContent: "space-between",
        marginTop: 6,
        padding: 6,
        background: "#222",
        borderRadius: 6,
      }}
    >
      <span>
        {s.name} ({s.category})
      </span>

      <div>
        <button onClick={() => handleApprove(s.id)}>✔</button>
        <button onClick={() => handleReject(s.id)}>✖</button>
      </div>
    </div>
  ))}
</div>

      {/* TREE */}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div
          style={{
            height: 400,
            border: "1px solid #333",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          
        <div className="gm-tree">
          <Tree
            data={treeData}
            openByDefault={false}
            width="100%"
            height={400}
          >
            {({ node, style }) => {
              const isCategoryNode = Array.isArray(node.data.children);
              const isIngredientNode = node.isLeaf && !isCategoryNode;

              return (
              <div
                style={style}
                className={`gm-node ${isIngredientNode ? "leaf" : "parent"}`}
                onClick={() => {
                  if (isCategoryNode || !node.isLeaf) node.toggle();
                }}
              >
                <div className="gm-node-left">
                  {(isCategoryNode || !node.isLeaf) && (
                    <span className="gm-arrow">
                      {node.isOpen ? "▼" : "▶"}
                    </span>
                  )}

                  {node.isLeaf && <span className="gm-dot">•</span>}

                  <span className="gm-name">
                    {isIngredientNode
                      ? getDisplayName(node.data.name)
                      : node.data.name}
                  </span>
                </div>

                {isIngredientNode && (
                  <div className="gm-node-right">
                    {node.data.allergens.length > 0 && (
                      <div className="gm-allergens">
                        {node.data.allergens.join(", ")}
                      </div>
                    )}

                    <button
                      type="button"
                      className="gm-semanticBtn"
                      onClick={(e) => {
                        e.stopPropagation();
                        openSemanticEditor(node.data);
                      }}
                    >
                      Semantics
                    </button>

                    {node.data.semanticGaps.length > 0 && (
                      <div className="gm-semanticGaps">
                        {node.data.semanticGaps.map((gap) => (
                          <span key={gap.key} title={gap.title}>
                            {gap.label}
                          </span>
                        ))}
                      </div>
                    )}

                    <span
                      className={`gm-semanticStatusBadge ${getSemanticStatusClass(
                        node.data.semanticStatus
                      )}`}
                    >
                      {formatSemanticStatus(node.data.semanticStatus)}
                    </span>

                    <button
                      type="button"
                      className="gm-deleteBtn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteIngredient(
                          node.data.ingredientId,
                          node.data.name
                        );
                      }}
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
              );
            }}
          </Tree>
        </div>
        </div>
      )}

      {semanticIngredient && (
        <div className="gm-modalOverlay" role="presentation">
          <div className="gm-semanticModal" role="dialog" aria-modal="true">
            <div className="gm-modalHeader">
              <div>
                <p>Ingredient semantics</p>
                <h3>{getDisplayName(semanticIngredient.name)}</h3>
              </div>
              <button
                type="button"
                className="gm-modalClose"
                onClick={closeSemanticEditor}
              >
                x
              </button>
            </div>

            {semanticLoading ? (
              <p className="gm-semanticNotice">Loading semantic data...</p>
            ) : (
              <>
                {semanticAvailable === false && (
                  <div className="gm-semanticWarning">
                    Semantic migration is pending. Current ingredients remain available,
                    but translations and aliases cannot be saved yet.
                  </div>
                )}

                {semanticError && semanticAvailable !== false && (
                  <div className="gm-semanticWarning">{semanticError}</div>
                )}

                {(semanticDraftValidation.criticalIssues.length > 0 ||
                  semanticDraftValidation.warnings.length > 0) && (
                  <div
                    className={[
                      "gm-semanticValidation",
                      semanticDraftValidation.criticalIssues.length > 0
                        ? "has-critical"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {semanticDraftValidation.criticalIssues.length > 0 && (
                      <strong>{semanticDraftValidation.criticalIssues[0]}</strong>
                    )}
                    {semanticDraftValidation.warnings.length > 0 && (
                      <ul>
                        {semanticDraftValidation.warnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <div className="gm-semanticGrid">
                  <label>
                    Canonical key
                    <input
                      value={semanticDraft.canonicalKey}
                      disabled={!semanticAvailable}
                      onChange={(e) =>
                        setSemanticDraft((current) => ({
                          ...current,
                          canonicalKey: e.target.value,
                        }))
                      }
                    />
                  </label>

                  <label>
                    Status
                    <select
                      value={semanticDraft.semanticStatus}
                      disabled={!semanticAvailable}
                      onChange={(e) =>
                        setSemanticDraft((current) => ({
                          ...current,
                          semanticStatus: e.target.value,
                        }))
                      }
                    >
                      {SEMANTIC_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Semantic category
                    <select
                      value={semanticDraft.semanticCategoryId || ""}
                      disabled={!semanticAvailable}
                      onChange={(e) =>
                        setSemanticDraft((current) => ({
                          ...current,
                          semanticCategoryId: e.target.value,
                        }))
                      }
                    >
                      <option value="">Unassigned</option>
                      {semanticCategories.map((semanticCategory) => (
                        <option key={semanticCategory.id} value={semanticCategory.id}>
                          {semanticCategory.defaultName}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="gm-semanticQuickActions">
                  <button
                    type="button"
                    disabled={!semanticAvailable || !semanticIngredient}
                    onClick={applySuggestedCanonicalKey}
                  >
                    Use suggested key
                  </button>
                  <button
                    type="button"
                    disabled={!semanticAvailable || !semanticIngredient}
                    onClick={applySuggestedSemanticCategory}
                  >
                    Use legacy category
                  </button>
                  <button
                    type="button"
                    disabled={!semanticAvailable || !semanticIngredient}
                    onClick={fillSpanishTranslationFromLegacyName}
                  >
                    Fill ES name
                  </button>
                  <button
                    type="button"
                    disabled={!semanticAvailable}
                    onClick={markNamedTranslationsReviewed}
                  >
                    Review named locales
                  </button>
                  <button
                    type="button"
                    disabled={!semanticAvailable || !semanticIngredient}
                    onClick={addAliasesFromTranslations}
                  >
                    Build aliases
                  </button>
                </div>

                <div className="gm-semanticSection">
                  <h4>Translations</h4>
                  <div className="gm-translations">
                    {semanticDraft.translations.map((translation) => (
                      <div key={translation.locale} className="gm-translationRow">
                        <span>{translation.locale.toUpperCase()}</span>
                        <input
                          value={translation.name}
                          disabled={!semanticAvailable}
                          placeholder="Display name"
                          onChange={(e) =>
                            updateTranslationDraft(
                              translation.locale,
                              "name",
                              e.target.value
                            )
                          }
                        />
                        <input
                          value={translation.description || ""}
                          disabled={!semanticAvailable}
                          placeholder="Description"
                          onChange={(e) =>
                            updateTranslationDraft(
                              translation.locale,
                              "description",
                              e.target.value
                            )
                          }
                        />
                        <label className="gm-reviewedToggle">
                          <input
                            type="checkbox"
                            checked={translation.isReviewed === true}
                            disabled={!semanticAvailable}
                            onChange={(e) =>
                              updateTranslationDraft(
                                translation.locale,
                                "isReviewed",
                                e.target.checked
                              )
                            }
                          />
                          Reviewed
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="gm-semanticSection">
                  <h4>Aliases</h4>
                  <textarea
                    value={semanticDraft.aliasesText}
                    disabled={!semanticAvailable}
                    placeholder="One alias per line. Example: garlic | en | US | display"
                    onChange={(e) =>
                      setSemanticDraft((current) => ({
                        ...current,
                        aliasesText: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="gm-modalActions">
                  <button type="button" onClick={closeSemanticEditor}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!semanticAvailable || semanticSaving || semanticSaveBlocked}
                    onClick={() => saveSemanticEditor({ advance: true })}
                  >
                    Save and next
                  </button>
                  <button
                    type="button"
                    className="gm-primaryBtn"
                    disabled={!semanticAvailable || semanticSaving || semanticSaveBlocked}
                    onClick={() => saveSemanticEditor()}
                  >
                    {semanticSaving ? "Saving..." : "Save semantics"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
