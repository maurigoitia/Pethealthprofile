import type { WellbeingSpeciesGroupId } from "../domain/wellbeing/WELLBEING_MASTER_BOOK";

// Mapea raza → grupo del WELLBEING_MASTER_BOOK para sugerencias térmicas y de comportamiento.
// Razas no listadas caen en el grupo default de su especie (dog.general / cat.general).
const BREED_GROUP_MAP: Record<string, WellbeingSpeciesGroupId> = {
  // Braquicéfalos — sensibles al calor
  "French Bulldog": "dog.brachycephalic",
  "Bulldog": "dog.brachycephalic",
  "Pug": "dog.brachycephalic",
  "Boston Terrier": "dog.brachycephalic",
  "Boxer": "dog.brachycephalic",
  "Shih Tzu": "dog.brachycephalic",
  "Pekingese": "dog.brachycephalic",
  "Brussels Griffon": "dog.brachycephalic",
  "Cavalier King Charles Spaniel": "dog.brachycephalic",
  "American Bulldog": "dog.brachycephalic",
  "American Bully Pocket": "dog.brachycephalic",
  "American Bully Standard": "dog.brachycephalic",
  "American Bully Classic": "dog.brachycephalic",
  "American Bully XL": "dog.brachycephalic",
  "American Bully XXL": "dog.brachycephalic",
  "American Bully Micro": "dog.brachycephalic",
  "American Bully Extreme": "dog.brachycephalic",
  "Bullmastiff": "dog.brachycephalic",
  "Chinese Shar-Pei": "dog.brachycephalic",
  "Lhasa Apso": "dog.brachycephalic",
  "Japanese Chin": "dog.brachycephalic",
  // Activos / Trabajo
  "Border Collie": "dog.active_working",
  "German Shepherd": "dog.active_working",
  "Belgian Malinois": "dog.active_working",
  "Belgian Sheepdog": "dog.active_working",
  "Belgian Tervuren": "dog.active_working",
  "Siberian Husky": "dog.active_working",
  "Alaskan Malamute": "dog.active_working",
  "Australian Cattle Dog": "dog.active_working",
  "Australian Shepherd": "dog.active_working",
  "Dutch Shepherd": "dog.active_working",
  "Doberman Pinscher": "dog.active_working",
  "Rottweiler": "dog.active_working",
  "Weimaraner": "dog.active_working",
  "Vizsla": "dog.active_working",
  "Rhodesian Ridgeback": "dog.active_working",
  "Dalmatian": "dog.active_working",
  "German Shorthaired Pointer": "dog.active_working",
  "German Wirehaired Pointer": "dog.active_working",
  "Pointer": "dog.active_working",
  // Compañía
  "Golden Retriever": "dog.companion",
  "Labrador Retriever": "dog.companion",
  "Beagle": "dog.companion",
  "Cocker Spaniel": "dog.companion",
  "English Cocker Spaniel": "dog.companion",
  "American Cocker Spaniel": "dog.companion",
  "Miniature Schnauzer": "dog.companion",
  "Standard Schnauzer": "dog.companion",
  "Giant Schnauzer": "dog.companion",
  "Poodle": "dog.companion",
  "Poodle Miniatura": "dog.companion",
  "Poodle Toy": "dog.companion",
  "Caniche": "dog.companion",
  "Caniche Toy": "dog.companion",
  "Caniche Miniatura": "dog.companion",
  "Caniche Enano": "dog.companion",
  "Maltese": "dog.companion",
  "Bichon Frisé": "dog.companion",
  "Havanese": "dog.companion",
  "Pomeranian": "dog.companion",
  "Chihuahua": "dog.companion",
  "Yorkshire Terrier": "dog.companion",
  // Gatos braquicéfalos
  "Persian": "cat.brachycephalic",
  "Exotic Shorthair": "cat.brachycephalic",
  "Himalayan": "cat.brachycephalic",
};

/**
 * Devuelve el WellbeingSpeciesGroupId para una raza + especie.
 * Si la raza no está mapeada, devuelve el grupo general de la especie.
 */
export function getBreedGroupId(
  breedName: string,
  species: "dog" | "cat" | "other",
): WellbeingSpeciesGroupId {
  const mapped = BREED_GROUP_MAP[breedName];
  if (mapped) return mapped;
  if (species === "cat") return "cat.general";
  return "dog.general";
}

export const DOG_BREEDS = [
  // American Bully y todas sus variantes
  "American Bully Pocket",
  "American Bully Standard",
  "American Bully Classic",
  "American Bully XL",
  "American Bully XXL",
  "American Bully Micro",
  "American Bully Extreme",
  // A
  "Affenpinscher", "Afghan Hound", "Airedale Terrier", "Akita", "Alaskan Malamute",
  "American Bulldog", "American Cocker Spaniel", "American Eskimo Dog",
  "American Foxhound", "American Pit Bull Terrier", "American Staffordshire Terrier",
  "Anatolian Shepherd", "Australian Cattle Dog", "Australian Shepherd",
  "Australian Terrier",
  // B
  "Basenji", "Basset Hound", "Beagle", "Bearded Collie", "Belgian Malinois",
  "Belgian Sheepdog", "Belgian Tervuren", "Bernese Mountain Dog", "Bichon Frisé",
  "Bloodhound", "Border Collie", "Border Terrier", "Boston Terrier", "Boxer",
  "Briard", "Brittany", "Brussels Griffon", "Bull Terrier", "Bulldog", "Bullmastiff",
  // C
  "Cairn Terrier", "Cane Corso", "Cardigan Welsh Corgi", "Cavalier King Charles Spaniel",
  "Chesapeake Bay Retriever", "Chihuahua", "Chinese Crested", "Chinese Shar-Pei",
  "Chow Chow", "Cocker Spaniel", "Collie",
  // D
  "Dachshund", "Dalmatian", "Doberman Pinscher", "Dogo Argentino", "Dutch Shepherd",
  // E
  "English Cocker Spaniel", "English Setter", "English Springer Spaniel",
  // F
  "Field Spaniel", "Finnish Spitz", "Flat-Coated Retriever", "Fox Terrier", "French Bulldog",
  // G
  "German Pinscher", "German Shepherd", "German Shorthaired Pointer",
  "German Wirehaired Pointer", "Giant Schnauzer", "Golden Retriever",
  "Gordon Setter", "Great Dane", "Great Pyrenees", "Greater Swiss Mountain Dog", "Greyhound",
  // H
  "Harrier", "Havanese",
  // I
  "Ibizan Hound", "Irish Setter", "Irish Terrier", "Irish Water Spaniel",
  "Irish Wolfhound", "Italian Greyhound",
  // J
  "Jack Russell Terrier", "Japanese Chin",
  // K
  "Keeshond", "Kerry Blue Terrier", "Komondor", "Kuvasz",
  // L
  "Labrador Retriever", "Lakeland Terrier", "Leonberger", "Lhasa Apso",
  // M
  "Maltese", "Manchester Terrier", "Mastiff", "Miniature Bull Terrier",
  "Miniature Pinscher", "Miniature Schnauzer",
  // N
  "Neapolitan Mastiff", "Newfoundland", "Norfolk Terrier", "Norwegian Elkhound", "Norwich Terrier",
  // O
  "Old English Sheepdog", "Otterhound",
  // P
  "Papillon", "Parson Russell Terrier", "Pekingese", "Pembroke Welsh Corgi",
  "Pharaoh Hound", "Pointer", "Pomeranian", "Poodle", "Poodle Miniatura", "Poodle Toy", "Caniche", "Caniche Toy", "Caniche Miniatura", "Caniche Enano",
  "Portuguese Water Dog", "Pug", "Puli",
  // R
  "Rat Terrier", "Rhodesian Ridgeback", "Rottweiler",
  // S
  "Saint Bernard", "Saluki", "Samoyed", "Schipperke", "Scottish Deerhound",
  "Scottish Terrier", "Sealyham Terrier", "Shetland Sheepdog", "Shiba Inu",
  "Shih Tzu", "Siberian Husky", "Silky Terrier", "Skye Terrier",
  "Soft Coated Wheaten Terrier", "Spinone Italiano", "Staffordshire Bull Terrier",
  "Standard Schnauzer",
  // T
  "Tibetan Mastiff", "Tibetan Spaniel", "Tibetan Terrier", "Toy Fox Terrier",
  // V
  "Vizsla",
  // W
  "Weimaraner", "Welsh Springer Spaniel", "Welsh Terrier", "West Highland White Terrier",
  "Whippet", "Wire Fox Terrier", "Wirehaired Pointing Griffon",
  // X Y
  "Xoloitzcuintli", "Yorkshire Terrier",
  // Mestizo
  "Mestizo / Criollo",
];

export const CAT_BREEDS = [
  "Abyssinian", "American Curl", "American Shorthair", "Balinese",
  "Bengal", "Birman", "Bombay", "British Longhair", "British Shorthair",
  "Burmese", "Burmilla", "Chartreux", "Cornish Rex", "Devon Rex",
  "Egyptian Mau", "European Shorthair", "Exotic Shorthair",
  "Himalayan", "Japanese Bobtail", "Korat", "LaPerm", "Maine Coon",
  "Manx", "Munchkin", "Norwegian Forest Cat", "Ocicat",
  "Oriental Shorthair", "Persian", "Peterbald", "Pixiebob",
  "Ragamuffin", "Ragdoll", "Russian Blue", "Savannah",
  "Scottish Fold", "Selkirk Rex", "Siamese", "Siberian",
  "Singapura", "Snowshoe", "Somali", "Sphynx",
  "Thai", "Tonkinese", "Turkish Angora", "Turkish Van",
  "Mestizo / Criollo",
];

export const OTHER_BREEDS = [
  "Conejo", "Hamster", "Cobayo / Cuy", "Hurón", "Tortuga",
  "Loro / Papagayo", "Canario", "Pez", "Lagarto / Reptil", "Otro",
];
