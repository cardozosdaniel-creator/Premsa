// Mapa municipi → vegueria (Catalunya, divisió oficial de 8 vegueries).
// Cobreix els municipis que apareixen a l'Excel inicial. Els municipis
// no reconeguts queden com a "" (sense assignar), i el desplegable de cada
// obra permet completar-los a mà. Aquest fitxer es carrega dins index.html.
window.VEGUERIES = {
  "alt-pirineu-aran":     { label:"Alt Pirineu i Aran" },
  "barcelona":            { label:"Barcelona" },
  "camp-tarragona":       { label:"Camp de Tarragona" },
  "catalunya-central":    { label:"Catalunya Central" },
  "comarques-gironines":  { label:"Comarques Gironines" },
  "penedes":              { label:"Penedès" },
  "ponent":               { label:"Ponent" },
  "terres-ebre":          { label:"Terres de l'Ebre" }
};

// Mapping principal (municipi normalitzat en minúscules → vegueria).
// Font: divisió territorial de la Generalitat.
window.MUNICIPI_VEGUERIA = {
  // Barcelona
  "barcelona":"barcelona", "l'hospitalet de llobregat":"barcelona", "hospitalet de llobregat":"barcelona",
  "badalona":"barcelona", "sant esteve sesrovires":"barcelona", "gavà":"barcelona", "gava":"barcelona",
  "castelldefels":"barcelona", "el prat de llobregat":"barcelona", "prat de llobregat":"barcelona",
  "sant feliu de llobregat":"barcelona", "sant celoni":"barcelona", "sant cugat":"barcelona",
  "sant cugat del vallès":"barcelona", "sant cugat del valles":"barcelona", "sabadell":"barcelona",
  "terrassa":"barcelona", "ripollet":"barcelona", "sentmenat":"barcelona", "caldes de montbui":"barcelona",
  "mollet":"barcelona", "mollet del vallès":"barcelona", "mollet del valles":"barcelona",
  "sant fruitós de bages":"catalunya-central", "sant fruitos de bages":"catalunya-central",
  "vic":"catalunya-central", "manresa":"catalunya-central", "fonollosa":"catalunya-central",
  "la llagosta":"barcelona", "mataró":"barcelona", "mataro":"barcelona",
  "vilanova i la geltrú":"penedes", "vilanova i la geltru":"penedes",
  "sant pere de ribes":"penedes", "gelida":"penedes", "cunit":"penedes",

  // Camp de Tarragona
  "tarragona":"camp-tarragona", "reus":"camp-tarragona", "torredembarra":"camp-tarragona",
  "falset":"camp-tarragona", "vila-rodona":"camp-tarragona", "pla de santa maria":"camp-tarragona",
  "el pla de santa maria":"camp-tarragona",

  // Comarques Gironines
  "girona":"comarques-gironines", "olot":"comarques-gironines", "palafrugell":"comarques-gironines",
  "lloret de mar":"comarques-gironines", "vall-llobrega":"comarques-gironines",

  // Ponent
  "lleida":"ponent", "balaguer":"ponent", "mollerussa":"ponent", "oliola":"ponent", "flix":"ponent",
  "bovera":"ponent", "seròs":"ponent", "seros":"ponent", "bell-lloc d'urgell":"ponent",
  "bell-lloc":"ponent", "almenar":"ponent", "arbeca":"ponent", "maldà":"ponent", "malda":"ponent",
  "omellons":"ponent", "la floresta":"ponent", "floresta":"ponent", "les borges blanques":"ponent",
  "borges blanques":"ponent", "granyena de les garrigues":"ponent", "torrebesses":"ponent",
  "l'albagés":"ponent", "albagés":"ponent", "albages":"ponent", "el cogul":"ponent", "cogul":"ponent",
  "aspa":"ponent", "alfés":"ponent", "alfes":"ponent", "llardecans":"ponent", "castellnou de seana":"ponent",

  // Terres de l'Ebre
  "amposta":"terres-ebre", "tortosa":"terres-ebre", "la ràpita":"terres-ebre", "la rapita":"terres-ebre",
  "flix":"terres-ebre",  // frontera; queda com a Ponent segons ordre superior
  "margalef":"terres-ebre",

  // Alt Pirineu i Aran
  "sort":"alt-pirineu-aran", "el pont de suert":"alt-pirineu-aran", "pont de suert":"alt-pirineu-aran",
  "tremp":"alt-pirineu-aran", "talarn":"alt-pirineu-aran", "vielha":"alt-pirineu-aran",
  "canejan":"alt-pirineu-aran", "la seu d'urgell":"alt-pirineu-aran", "seu d'urgell":"alt-pirineu-aran",
  "organyà":"alt-pirineu-aran", "organya":"alt-pirineu-aran",
  "el pla de sant tirs":"alt-pirineu-aran", "pla de sant tirs":"alt-pirineu-aran",
  "oliana":"alt-pirineu-aran", "bellver de cerdanya":"alt-pirineu-aran",
  "artesa de segre":"ponent",  // pertany a Ponent
  "vall-llebrera":"ponent",

  // Catalunya Central
  "igualada":"catalunya-central", "colomers":"comarques-gironines",

  // Penedès
  "sant feliu de codines":"barcelona"  // històricament Barcelona
};

// Del text "Municipi 1, Municipi 2" o "Municipi (aclariment)", extreu el
// primer municipi net i el compara contra el mapa. Retorna la clau de
// vegueria o "" si no la reconeix.
window.municipiToVegueria = function(loc){
  if (!loc || loc === "—") return "";
  var s = String(loc).toLowerCase()
    .replace(/\([^)]*\)/g, "")                // treu comentaris entre parèntesis
    .replace(/pendent (de )?confirmar/gi, "");
  var first = s.split(/[,;/]| i /)[0].trim();
  if (window.MUNICIPI_VEGUERIA[first]) return window.MUNICIPI_VEGUERIA[first];
  // Prova amb tots els municipis del text — el primer que trobem
  var parts = s.split(/[,;/]| i /).map(function(p){ return p.trim(); });
  for (var i = 0; i < parts.length; i++){
    if (window.MUNICIPI_VEGUERIA[parts[i]]) return window.MUNICIPI_VEGUERIA[parts[i]];
  }
  return "";
};
