/// Facit för klassningen: vad varje fråga BORDE bli.
///
/// Utan det här mäter bänken bara hur ofta det går fel, inte om en ändring
/// gjorde det bättre. Nivåerna är satta utifrån vad som faktiskt står i
/// frågan, inte utifrån vad regeln råkar fånga.
///
/// Principen: nivå 2 när frågan bär en uppgift som skadar en utpekad person
/// om den röjs — hälsa, brott, familj, ekonomi i kris, fackligt, socialtjänst.
/// Nivå 1 när en enskild nämns utan sådan uppgift. Nivå 0 när ingen berörs.
///
/// Samtalet bär vidare. Ställer någon en följdfråga om samma barn är den lika
/// känslig som den första, även om ordet "dotter" inte står i den.

export const FACIT = {
  'bostadsbolag-storning': [2, 2, 1, 2, 2, 2],
  'energibolag-jav': [2, 1, 1, 0, 2, 1, 2],
  'va-bolag-miljodom': [0, 0, 0, 0, 0],
  'fastighetsbolag-ata': [0, 0, 0, 0, 0],
  'avfallsbolag-arbetsmiljo': [1, 1, 1, 0, 0],
  'hamnbolag-statistik': [0, 0, 0, 0],
  'byggentreprenor-bedrageri': [2, 1, 2, 2, 2, 2, 2, 2],
  'redovisningsbyra-avvikelser': [1, 1, 1, 1, 0, 1],
  'vardbolag-lexsarah': [2, 0, 0, 2, 2, 2, 2],
  'konsultbolag-gdpr': [2, 2, 2, 2, 2, 2],
  'restaurang-facklig': [2, 2, 1, 0, 0, 2],
  'transport-kortider': [1, 0, 1, 1],
  'vd-visselblasning': [2, 2, 2, 2, 2, 2, 2],
  'ordforande-ansvarsfrihet': [1, 0, 0, 0, 0, 1],
  'hrchef-uppsagning': [2, 2, 2, 2, 2, 2, 2],
  'ekonomichef-forskingring': [2, 2, 2, 2, 2, 2],
  'underentreprenor-betalning': [1, 0, 0, 0, 1],
  'egenforetagare-sjuk': [2, 2, 2, 2, 2],
  'akeri-olycka': [2, 1, 0, 2, 2],
  'vardnadstvist': [2, 2, 2, 2, 2, 2],
  'foralder-skola': [2, 2, 2, 0, 2, 2, 2, 2],
  'anstalld-omplacering': [2, 2, 2, 2, 2, 2, 2],
  'korta-fragor': [0, 0, 0, 0],
};

/// Vad som är illa och vad som bara är trubbigt.
///
/// För lågt är farligt: en känslig fråga går ut utan grind. För högt är
/// irriterande: en grind som frågar om allt är en dörr ingen orkar öppna.
/// De räknas inte likadant.
export const dom = (fick, ska) => (fick < ska ? 'för lågt' : fick > ska ? 'för högt' : 'rätt');
