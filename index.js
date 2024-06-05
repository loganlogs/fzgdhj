import fetch from "node-fetch";
import { Client, Intents, MessageActionRow, MessageButton, MessageEmbed, MessageAttachment } from "discord.js";
import fs from "fs";
import path from "path";
import pkg from "fake-useragent";
const { UserAgent } = pkg;
import https from "https";
import axios from "axios";
import { spawn } from "child_process";

const client = new Client({
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES]
});

let rawdata = fs.readFileSync("config.json");
let config = JSON.parse(rawdata);
const token = config.token;
const prefix = config.prefix;

const dbDirectory = "./db";
const infoFilePath = "./info.json";
const noteFilePath = "./note.json";

// Initialisation de accessData
let accessData = {};
const accessFilePath = "./access.json";

if (fs.existsSync(accessFilePath)) {
  const data = fs.readFileSync(accessFilePath, "utf8");
  if (data) {
    accessData = JSON.parse(data);
  }
}


// ANTI CRASH
process.on("uncaughtException", (error, origin) => {
  console.log("----- Uncaught exception -----");
  console.log(error);
  console.log("----- Exception origin -----");
  console.log(origin);
});

process.on("unhandledRejection", (reason, promise) => {
  console.log("----- Unhandled Rejection at -----");
  console.log(promise);
  console.log("----- Reason -----");
  console.log(reason);
});

function getUniqueFileName(baseName) {
  const timestamp = new Date().toISOString().replace(/:/g, "-");
  return `${baseName}_${timestamp}.txt`;
}

let pyProcess;
const defaultImageUrl =
  "https://cdn.discordapp.com/attachments/1218778860338806806/1218785956551725097/template.png?ex=6608eddf&is=65f678df&hm=3d83454a2023d6cb2b0e10b4d4901668da12fcb52336ec4b3727d0963e78764b&";

let userData = {};
if (fs.existsSync(infoFilePath)) {
  const data = fs.readFileSync(infoFilePath, "utf8");
  if (data) {
    userData = JSON.parse(data);
  }
}

let noteData = {};
if (fs.existsSync(noteFilePath)) {
  const data = fs.readFileSync(noteFilePath, "utf8");
  if (data) {
    noteData = JSON.parse(data);
  }
}

const cooldowns = {};
client.once("ready", () => {
  console.log(`Le bot Discord est maintenant prêt.`);
  console.log(`Connecté en tant que: ${client.user.tag}`);
  console.log(`Préfixe du bot: ${config.prefix}`);

  // Récupérer les identifiants des propriétaires du bot depuis le fichier config.json
  const owners = config.owner.map((ownerId) => `<@${ownerId}>`).join(", ");

  // Récupérer le nombre de serveurs
  const guildsCount = client.guilds.cache.size;

  // Récupérer le nombre de personnes dans toutes les bases de données
  const totalMembersCount = client.guilds.cache.reduce(
    (acc, guild) => acc + guild.memberCount,
    0,
  );

  // Envoi des informations dans le canal de logs
  const logsChannel = client.channels.cache.get(config.logsstartchannel);
  if (logsChannel) {
    const embed = new MessageEmbed()
      .setColor("#0099ff")
      .setTitle("Le bot start !")
      .setThumbnail(client.user.displayAvatarURL())
      .addField("Bot prêt", "Le bot Discord est maintenant prêt.", true)
      .addField("Connecté en tant que", client.user.tag.toString(), true)
      .addField("Préfixe du bot", config.prefix.toString(), true)
      .addField("Owner du bot", owners.toString(), false)
      .addField("Nombre de serveurs", guildsCount.toString(), true)
      .addField(
        "Nombre total de personnes dans les serveurs",
        totalMembersCount.toString(),
        true,
      )
      .setFooter("⭐ Lookup France");

    logsChannel.send({ embeds: [embed] });
  } else {
    console.error(
      `Le canal de logs avec l'ID ${config.logsstartchannel} est introuvable.`,
    );
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.mentions.has(client.user)) {
    message.channel.send(`Mon prefix est \`${prefix}\``);
    return;
  }

  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  function countFiles(directory) {
    const files = fs.readdirSync(directory);
    return files.length;
  }
  const dbDirectoryPath = "./db";
  let updateInterval;
  const numberOfDBFiles = fs.readdirSync(dbDirectoryPath).length;

  if (command === "scrap") {
    if (!config.owner.includes(message.author.id)) {
      message.channel.send(
        "Vous n'avez pas la permission d'exécuter cette commande.",
      );
      return;
    }
    let totalPlayers = 0;
    if (args.length === 0) {
      message.channel.send(
        'Veuillez spécifier "start", "stop" ou "info" après la commande.',
      );
      return;
    }

    const subCommand = args[0].toLowerCase();

    let pyProcess; // Variable pour stocker le processus Python
    let updateInterval; // Variable pour stocker l'intervalle de mise à jour

    if (subCommand === "start") {
      // Exécutez le script Python en utilisant python3 (ou python selon votre configuration)
      pyProcess = spawn("python3", ["index.py"]);

      pyProcess.stdout.on("data", (data) => {
        console.log(`stdout: ${data}`);
      });

      pyProcess.stderr.on("data", (data) => {
        console.error(`stderr: ${data}`);
      });

      pyProcess.on("close", (code) => {
        console.log(`Le processus Python s'est terminé avec le code ${code}`);
      });

      const scrapMessage = await message.channel.send("Scraping démarré.");

      updateInterval = setInterval(() => {
        let totalLines = 0; // Variable pour stocker le total de lignes dans tous les fichiers
        fs.readdir(dbDirectoryPath, (err, files) => {
          if (err) {
            console.error(err);
            return;
          }
          files.forEach((file) => {
            const filePath = path.join(dbDirectoryPath, file);
            const fileLines = fs
              .readFileSync(filePath, "utf8")
              .split("\n").length;
            totalLines += fileLines; // Additionner le nombre de lignes dans chaque fichier
          });

          // Mise à jour de l'embed avec le nombre total de lignes dans la base de données
          const guildLogo = message.guild.iconURL({
            dynamic: true,
            format: "png",
            size: 256,
          });
          const guildBanner = message.guild.bannerURL({
            dynamic: true,
            format: "png",
            size: 4096,
          });
          const scrapEmbed = new MessageEmbed()
            .setColor("#0099ff")
            .setTitle("Scraping démarré")
            .setDescription("Le scraping est actuellement en cours.")
            .addField("<a:rose_blue:1218958079690018887>   Status", "ON", true)
            .addField(
              "<:memeified_monster_blue:1218958077596926074>    Nombre de bases de données",
              numberOfDBFiles.toString(),
              true,
            )
            .addField(
              "<:blue_moon:1218958081677856768> Nombre de personnes dans la base de données",
              totalLines.toString(),
              true,
            ) // Correction ici
            .setFooter("⭐ Lookup France")
            .setTimestamp();

          if (guildLogo) {
            scrapEmbed.setThumbnail(guildLogo);
          }

          if (guildBanner) {
            scrapEmbed.setImage(guildBanner);
          }
          scrapMessage.edit({ embeds: [scrapEmbed] }).catch(console.error); // Ajout d'une gestion d'erreur
        });
      }, 1000);
    } else if (subCommand === "stop") {
      if (pyProcess) {
        pyProcess.kill();
        clearInterval(updateInterval);
        message.channel.send("Scraping arrêté avec succès.");
      } else {
        message.channel.send("Aucun processus de scraping en cours.");
      }
    } else if (subCommand === "info") {
      message.channel.send(" processus de prise des info en cours.");
      let totalLines = 0; // Variable pour stocker le total de lignes dans tous les fichiers
      fs.readdir(dbDirectoryPath, (err, files) => {
        if (err) {
          console.error(err);
          return;
        }
        files.forEach((file) => {
          const filePath = path.join(dbDirectoryPath, file);
          const fileLines = fs
            .readFileSync(filePath, "utf8")
            .split("\n").length;
          totalLines += fileLines; // Additionner le nombre de lignes dans chaque fichier
        });

        const infoEmbed = new MessageEmbed()
          .setColor("#0099ff")
          .setTitle("Informations sur le scraping")
          .setDescription("Voici des informations sur le scraping en cours :")
          .addField("Status", pyProcess ? "Actif" : "Inactif")
          .addField(
            "Total des joueurs dans la base de données",
            totalLines.toString(),
          )
          .setFooter("⭐ Lookup France")
          .setTimestamp();

        message.channel.send({ embeds: [infoEmbed] }).catch(console.error);
      });
    } else {
      message.channel.send(
        'Commande invalide. Veuillez spécifier "start", "stop" ou "info" après la commande.',
      );
    }
  }

  if (command === "cfxadd") {
    if (!config.owner.includes(message.author.id)) {
      message.channel.send(
        "Vous n'avez pas la permission d'exécuter cette commande.",
      );
      return;
    }

    if (cooldowns[command] && cooldowns[command] > Date.now()) {
      message.reply("Cooldown de 5 secondes pour la commande.");
      return;
    }

    cooldowns[command] = Date.now() + 5000; // 5000 millisecondes = 5 secondes
    if (!args[0]) {
      message.reply("Veuillez fournir le nom du serveur.");
      return;
    }

    const serverName = args.join(" ");
    const defaultImageUrl =
      "https://cdn.discordapp.com/attachments/1218778860338806806/1218785956551725097/template.png?ex=6608eddf&is=65f678df&hm=3d83454a2023d6cb2b0e10b4d4901668da12fcb52336ec4b3727d0963e78764b&";
    // Envoyer un message initial sous forme d'embed pour indiquer que le processus commence
    const startEmbed = new MessageEmbed()
      .setColor("#0099ff")
      .setTitle("Ajout du serveur au scrapper")
      .setDescription("Le processus de mise à jour du scrapper a commencé.")
      .setFooter("⭐ Lookup France")
      .setImage(defaultImageUrl);

    const startMessage = await message.channel.send({ embeds: [startEmbed] });

    // Ajouter le nom du serveur à serveur.txt
    fs.appendFile("serveur.txt", `${serverName}\n`, (err) => {
      if (err) {
        console.error(err);
        message.reply("Une erreur est survenue lors de l'ajout du serveur.");
        return;
      }
      console.log(`Le serveur '${serverName}' a été ajouté à serveur.txt`);
    });

    // Exécuter le script serverinfo.py avec le nom du serveur comme argument
    const pyProcess = spawn("python3", ["serverscrapadd.py", serverName]);

    // Attente de la fin de l'exécution du script
    pyProcess.on("close", (code) => {
      console.log(`Le processus Python s'est terminé avec le code ${code}`);

      // Lire le contenu de requete.txt
      fs.readFile("requete.txt", "utf8", (err, data) => {
        if (err) {
          console.error(err);
          message.reply(
            "Une erreur est survenue lors de la lecture de requete.txt.",
          );
          return;
        }

        // Modifier l'embed initial pour inclure le nom du serveur une fois que le processus est terminé
        const endEmbed = new MessageEmbed()
          .setColor("#0099ff")
          .setTitle("Serveur ajouté au scrapper")
          .setDescription(`Le serveur ${data} a été ajouté au scrapper.`)
          .setFooter("⭐ Lookup France");

        startMessage.edit({ embeds: [endEmbed] });

        // Supprimer requete.txt
        fs.unlink("requete.txt", (err) => {
          if (err) {
            console.error(err);
            return;
          }
          console.log("requete.txt a été supprimé.");
        });
      });
    });
  }
  if (command === "setpic") {
    if (!config.owner.includes(message.author.id)) {
      message.channel.send(
        "Vous n'avez pas la permission d'exécuter cette commande.",
      );
      return;
    }

    // Vérifier si un lien vers une image a été fourni
    if (!args[0]) {
      message.channel.send("Veuillez fournir un lien vers une image.");
      return;
    }

    // Récupérer le lien de l'image à partir des arguments
    const imageLink = args[0];

    // Modifier la photo de profil du bot
    client.user
      .setAvatar(imageLink)
      .then(() => {
        message.channel.send(
          "La photo de profil a été mise à jour avec succès.",
        );
      })
      .catch((error) => {
        console.error(
          "Erreur lors de la mise à jour de la photo de profil :",
          error,
        );
        message.channel.send(
          "Une erreur est survenue lors de la mise à jour de la photo de profil.",
        );
      });
  }

  if (command === "setname") {
    if (!config.owner.includes(message.author.id)) {
      message.channel.send(
        "Vous n'avez pas la permission d'exécuter cette commande.",
      );
      return;
    }

    // Vérifier si un nouveau nom a été fourni
    if (!args[0]) {
      message.channel.send("Veuillez fournir un nouveau nom.");
      return;
    }

    // Modifier le nom du bot
    client.user
      .setUsername(args.join(" "))
      .then(() => {
        message.channel.send("Le nom du bot a été mis à jour avec succès.");
      })
      .catch((error) => {
        console.error("Erreur lors de la mise à jour du nom du bot :", error);
        message.channel.send(
          "Une erreur est survenue lors de la mise à jour du nom du bot.",
        );
      });
  }

  if (command === "cfxlist") {
    fs.readFile("serveur.txt", "utf8", (err, data) => {
      if (err) {
        console.error(err);
        return message.reply(
          "Une erreur est survenue lors de la lecture des serveurs.",
        );
      }

      // Compter le nombre de lignes
      const linesCount = data.split("\n").length;
      const defaultImageUrl =
        "https://cdn.discordapp.com/attachments/1218778860338806806/1218785956551725097/template.png?ex=6608eddf&is=65f678df&hm=3d83454a2023d6cb2b0e10b4d4901668da12fcb52336ec4b3727d0963e78764b&";
      // Créer un embed avec le nombre de lignes
      const embed = new MessageEmbed()
        .setColor("#0099ff")
        .setTitle("Liste des Serveurs")
        .setDescription(`Nombre total de serveurs : ${linesCount}`)
        .setImage(defaultImageUrl)
        .setFooter("⭐ Lookup France");

      // Envoyer l'embed dans le canal
      message.channel.send({ embeds: [embed] });
    });
  }

  // COMMANDE BLACKLISTDB

  function loadBlacklist() {
    try {
      const data = fs.readFileSync("blacklist.json");
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  function addToBlacklist(identifier) {
    let blacklist = loadBlacklist();
    blacklist.push(identifier);
    fs.writeFileSync("blacklist.json", JSON.stringify(blacklist));
  }

  function isBlacklistedId(identifier) {
    let blacklist = loadBlacklist();
    return blacklist.includes(identifier.toLowerCase());
  }

  if (command === "blacklistdb") {
    if (!config.owner.includes(message.author.id)) {
      message.channel.send(
        "Vous n'avez pas la permission d'exécuter cette commande.",
      );
      return;
    }

    if (args.length === 0) {
      message.channel.send("Veuillez fournir un identifiant à retirer des db.");
      return;
    }

    const identifier = args.join(" ").toLowerCase();

    addToBlacklist(identifier);

    message.channel.send(`L'identifiant "${identifier}" a été retiré des db.`);
  }

  if (command === "lookup") {
    if (message.channel.id !== config.lookupchannel) {
      return message.reply(
        "Cette commande ne peut être utilisée que dans le salon autorisé.",
      );
    }

    if (args.length === 0) {
      message.channel.send("Aucun identifiant entré.");
      return;
    }

    const searchText = args.join(" ");

    if (isBlacklistedId(searchText)) {
      message.channel.send("Aucun résultat trouvé.");
      return;
    }

    const files = fs.readdirSync(dbDirectory);

    // Message "Votre requête est en cours"
    const loadingEmbed = new MessageEmbed()
      .setColor("#0099ff")
      .setTitle("Recherche en cours")
      .setDescription(
        "Votre requête est en cours de traitement. Veuillez patienter...",
      );

    const loadingMessage = await message.channel.send({
      embeds: [loadingEmbed],
    });

    let embed = new MessageEmbed()
      .setColor("#0099ff")
      .setTitle("Résultats de la recherche")
      .setFooter("⭐ Lookup France");

    let found = false;
    let foundResults = ""; // Variable pour stocker les résultats trouvés

    for (const file of files) {
      const filePath = path.join(dbDirectory, file);
      const data = fs.readFileSync(filePath, "utf8");
      const lines = data.split("\n");

      lines.forEach((line) => {
        if (line.includes(searchText)) {
          embed.addField(`Dans le fichier ${file}`, line);
          foundResults += `
       
                                        Found in ${file}:
                                     ╔══════════════════════════════════════════╗
                                     ║                                          ║
                                     ║       Search made ByOrx                  ║
                                     ║                                          ║
                                     ╚══════════════════════════════════════════╝ 
                                     
        
        ${line}\n`; // Ajoute les résultats trouvés
          found = true;
        }
      });
    }

    if (!found) {
      message.channel.send("Aucun résultat trouvé.");
    } else {
      // Création du bouton "Send MP"
      const row = new MessageActionRow().addComponents(
        new MessageButton()
          .setCustomId("send_mp_button")
          .setLabel("Send MP")
          .setStyle("PRIMARY"),
      );

      // Envoi de l'embed avec le bouton dans le canal
      const messageSent = await message.channel.send({ components: [row] });

      // Création de la fonction pour envoyer le MP
      const sendMP = async () => {
        const user = message.author;
        const attachment = new MessageAttachment(
          Buffer.from(foundResults),
          "results.txt",
        );

        try {
          await user.send({ files: [attachment] });
          message.channel.send("Résultats envoyés en MP.");
        } catch (error) {
          console.error("Impossible d'envoyer le message privé :", error);
          message.channel.send(
            "Une erreur s'est produite lors de l'envoi des résultats en MP.",
          );
        }
      };

      // Création du gestionnaire d'événements pour le bouton
      const filter = (i) =>
        i.customId === "send_mp_button" && i.user.id === message.author.id;
      const collector = messageSent.createMessageComponentCollector({
        filter,
        time: 15000,
      });

      collector.on("collect", async () => {
        await sendMP();
        collector.stop();
      });

      collector.on("end", () => {
        if (!messageSent.deleted) {
          messageSent.edit({ components: [] }); // Supprimer les boutons
        }
      });
    }

    // Suppression du message "Votre requête est en cours"
    loadingMessage.delete();
  }

  if (command === "help") {
    const defaultImageUrl =
      "https://cdn.discordapp.com/attachments/1218778860338806806/1218785956551725097/template.png?ex=6608eddf&is=65f678df&hm=3d83454a2023d6cb2b0e10b4d4901668da12fcb52336ec4b3727d0963e78764b&";

    const embed = new MessageEmbed()
      .setColor("#0099ff")
      .setTitle("Liste des commandes disponibles")
      .setDescription(
        `Utilisez ${prefix} suivi du nom de la commande pour l'utiliser.`,
      )
      .addField(
        "helplookup",
        `Pour voir les commandes par rapport aux commandes lookup !`,
      )
      .addField(
        "helpowner",
        `Pour voir les commandes par rapport aux commandes owner !`,
      )
      .addField("helpcfx", `Pour voir les commandes par rapport aux serveurs !`)
      .setFooter("⭐ Lookup France")
      .setImage(defaultImageUrl);

    message.channel.send({ embeds: [embed] });
  }
  if (command === "helplookup") {
    const defaultImageUrl =
      "https://cdn.discordapp.com/attachments/1218778860338806806/1218785956551725097/template.png?ex=6608eddf&is=65f678df&hm=3d83454a2023d6cb2b0e10b4d4901668da12fcb52336ec4b3727d0963e78764b&";

    const embed = new MessageEmbed()
      .setColor("#0099ff")
      .setTitle("Liste des commandes disponibles")
      .setDescription(
        `Utilisez ${prefix} suivi du nom de la commande pour l'utiliser.`,
      )
      .addField(
        "scrap",
        `Pour démarrer ou arrêter le scraping des données. Exemple: \n\`${prefix}scrap start\` pour démarrer, \`${prefix}scrap stop\` pour arrêter.`,
      )
      .addField(
        "lookup",
        `Pour rechercher les identifiants d'une personne. Exemple: \n\`${prefix}lookup <ID Discord>\``,
      )
      .addField(
        "link",
        `Pour associer des informations à une personne. Exemple: \n\`${prefix}link <License> (sa license fivem)\``,
      )
      .addField(
        "user",
        `Pour afficher les informations d'une personne. Exemple: \n\`\`${prefix}user <ID Discord>\`\``,
      )
      .addField(
        "note",
        `Pour mettre une note sur une personne. Exemple: \n\`${prefix}note <ID Discord> <la note>\``,
      )
      .setFooter("⭐ Lookup France")
      .setImage(defaultImageUrl);

    message.channel.send({ embeds: [embed] });
  }
  if (command === "helpcfx") {
    const defaultImageUrl =
      "https://cdn.discordapp.com/attachments/1218778860338806806/1218785956551725097/template.png?ex=6608eddf&is=65f678df&hm=3d83454a2023d6cb2b0e10b4d4901668da12fcb52336ec4b3727d0963e78764b&";

    const embed = new MessageEmbed()
      .setColor("#0099ff")
      .setTitle("Liste des commandes disponibles")
      .setDescription(
        `Utilisez ${prefix} suivi du nom de la commande puis du cfx id du serveur en question !`,
      )
      .addField(
        "cfxadd",
        `Pour ajouter un serveur au scrapper  Exemple: \n\`${prefix}cfxadd <CFXID>\``,
      )
      .addField(
        "cfxinfo",
        `Pour avoir les info d'un serveur  Exemple: \n\`${prefix}cfxinfo <CFXID>\``,
      )
      .addField(
        "cfxlist",
        `Pour avoir la list des serveurs qui vont etre scrap  Exemple: \n\`${prefix}cfxlist\``,
      )
      .setFooter("⭐ Lookup France")
      .setImage(defaultImageUrl);

    message.channel.send({ embeds: [embed] });
  }

  if (command === "helpowner") {
    const defaultImageUrl =
      "https://cdn.discordapp.com/attachments/1218778860338806806/1218785956551725097/template.png?ex=6608eddf&is=65f678df&hm=3d83454a2023d6cb2b0e10b4d4901668da12fcb52336ec4b3727d0963e78764b&";

    const embed = new MessageEmbed()
      .setColor("#0099ff")
      .setTitle("Liste des commandes disponibles")
      .setDescription(
        `Utilisez ${prefix} suivi du nom de la commande pour l'utiliser.`,
      )
      .addField(
        "setpic",
        `Pour changer la photo de profil du bot. Exemple: \n\`${prefix}setpic <lien vers l'image>\``,
      )
      .addField(
        "setname",
        `Pour changer le nom du bot. Exemple: \n\`${prefix}setname <nouveau nom>\``,
      )
      .addField(
        "owner",
        `Pour ajouter un nouvel owner au bot. Exemple: \n\`${prefix}owner @mention\``,
      )
      .addField(
        "unowner",
        `Pour retirer un owner du bot. Exemple: \n\`${prefix}unowner @mention\``,
      )
      .addField("owners", `Affiche la liste de tous les owners du bot.`)
      .addField(
        "wl",
        `Pour ajouter un nouvel wl au bot. Exemple: \n\`${prefix}wl @mention\``,
      )
      .addField(
        "unwl",
        `Pour retirer un wl du bot. Exemple: \n\`${prefix}unwl @mention\``,
      )
      .addField("wllist", `Affiche la liste de tous les wl du bot.`)
      .setFooter("⭐ Lookup France")
      .setImage(defaultImageUrl);

    message.channel.send({ embeds: [embed] });
  }

  if (command === "link") {
    const [userId, infoType, infoValue] = args;
    if (!userId || !infoType || !infoValue) {
      message.channel.send(
        `Utilisation: ${prefix}link <ID Discord> <Identifier> <Identifiant>`,
      );
      return;
    }
    if (!userData[userId]) {
      userData[userId] = [];
    }
    userData[userId].push({ type: infoType, value: infoValue });
    saveData();
    message.channel.send(`Informations ajoutées pour l'utilisateur ${userId}.`);
  }

  if (command === "note") {
    const userId = args.shift();
    const noteValue = args.join(" ");

    if (!userId || !noteValue) {
      message.channel.send(`Utilisation : ${prefix}note <>ID Discord> <Note>`);
      return;
    }
    if (!noteData[userId]) {
      noteData[userId] = [];
    }
    noteData[userId].push(noteValue);
    saveNoteData();
    message.channel.send(`Note mise à jour pour l'utilisateur ${userId}`);
  }

  if (command === "owner") {
    // Vérifier si l'utilisateur est autorisé à ajouter un owner
    const userId = message.author.id;
    const owners = config.owner;

    if (!config.owner.includes(message.author.id)) {
      message.channel.send(
        "Vous n'avez pas la permission d'exécuter cette commande.",
      );
      return;
    }

    // Extraire l'ID de l'utilisateur à ajouter comme owner
    const mention = message.mentions.users.first();
    if (!mention) {
      message.channel.send(
        "Vous devez mentionner un utilisateur à ajouter comme owner.",
      );
      return;
    }

    const newOwnerId = mention.id;

    // Ajouter le nouvel owner à la liste dans le fichier config.json
    config.owner.push(newOwnerId);

    // Enregistrer les modifications dans le fichier config.json
    fs.writeFile("config.json", JSON.stringify(config, null, 2), (err) => {
      if (err) {
        console.error(
          "Erreur lors de l'écriture dans le fichier config.json :",
          err,
        );
        message.channel.send(
          "Une erreur s'est produite lors de l'ajout du nouvel owner. Veuillez réessayer.",
        );
      } else {
        message.channel.send(`Nouvel owner ajouté avec succès: ${mention}.`);
      }
    });
  }

  if (command === "unowner") {
    // Vérifier si l'utilisateur est autorisé à retirer un owner
    const userId = message.author.id;
    const owners = config.owner;

    if (!config.owner.includes(message.author.id)) {
      message.channel.send(
        "Vous n'avez pas la permission d'exécuter cette commande.",
      );
      return;
    }

    // Extraire l'ID de l'utilisateur à retirer comme owner
    const mention = message.mentions.users.first();
    if (!mention) {
      message.channel.send(
        "Vous devez mentionner un utilisateur à retirer comme owner.",
      );
      return;
    }

    const ownerIdToRemove = mention.id;

    // Retirer l'owner de la liste dans le fichier config.json
    const index = config.owner.indexOf(ownerIdToRemove);
    if (index !== -1) {
      config.owner.splice(index, 1);
    }

    // Enregistrer les modifications dans le fichier config.json
    fs.writeFile("config.json", JSON.stringify(config, null, 2), (err) => {
      if (err) {
        console.error(
          "Erreur lors de l'écriture dans le fichier config.json :",
          err,
        );
        message.channel.send(
          "Une erreur s'est produite lors du retrait de l'owner. Veuillez réessayer.",
        );
      } else {
        message.channel.send(`Owner retiré avec succès: ${mention}.`);
      }
    });
  }

  if (command === "owners") {
    // Lire la liste des owners depuis le fichier config.json
    const owners = config.owner;

    // Vérifier si la liste des owners est vide
    if (!owners || owners.length === 0) {
      message.channel.send("La liste des owners est vide.");
      return;
    }

    // Créer un tableau pour stocker les mentions des owners
    let ownerMentions = [];

    // Pour chaque ID d'owner dans la liste, mentionner l'utilisateur correspondant
    owners.forEach((ownerId) => {
      ownerMentions.push(`<@${ownerId}>`);
    });

    // Créer un embed contenant la liste des owners
    const embed = new MessageEmbed()
      .setColor("#0099ff")
      .setTitle("Liste des Owners")
      .setDescription(`${ownerMentions.join("\n")}`)
      .setFooter("⭐ Lookup France");

    // Envoyer l'embed dans le canal
    message.channel.send({ embeds: [embed] });
  }

  if (command === "wl") {
    // Vérifier si l'utilisateur est autorisé à ajouter un wl
    const userId = message.author.id;
    const wls = config.wl;

    if (!config.owner.includes(message.author.id)) {
      message.channel.send(
        "Vous n'avez pas la permission d'exécuter cette commande.",
      );
      return;
    }

    // Extraire l'ID de l'utilisateur à ajouter comme wl
    const mention = message.mentions.users.first();
    if (!mention) {
      message.channel.send(
        "Vous devez mentionner un utilisateur à ajouter comme wl.",
      );
      return;
    }

    const newwlId = mention.id;

    // Ajouter le nouvel wl à la liste dans le fichier config.json
    config.wl.push(newwlId);

    // Enregistrer les modifications dans le fichier config.json
    fs.writeFile("config.json", JSON.stringify(config, null, 2), (err) => {
      if (err) {
        console.error(
          "Erreur lors de l'écriture dans le fichier config.json :",
          err,
        );
        message.channel.send(
          "Une erreur s'est produite lors de l'ajout du nouvel wl. Veuillez réessayer.",
        );
      } else {
        message.channel.send(`Nouvel wl ajouté avec succès: ${mention}.`);
      }
    });
  }

  if (command === "unwl") {
    // Vérifier si l'utilisateur est autorisé à retirer un wl
    const userId = message.author.id;
    const wls = config.wl;

    if (!config.owner.includes(message.author.id)) {
      message.channel.send(
        "Vous n'avez pas la permission d'exécuter cette commande.",
      );
      return;
    }

    // Extraire l'ID de l'utilisateur à retirer comme wl
    const mention = message.mentions.users.first();
    if (!mention) {
      message.channel.send(
        "Vous devez mentionner un utilisateur à retirer comme wl.",
      );
      return;
    }

    const wlIdToRemove = mention.id;

    // Retirer l'wl de la liste dans le fichier config.json
    const index = config.wl.indexOf(wlIdToRemove);
    if (index !== -1) {
      config.wl.splice(index, 1);
    }

    // Enregistrer les modifications dans le fichier config.json
    fs.writeFile("config.json", JSON.stringify(config, null, 2), (err) => {
      if (err) {
        console.error(
          "Erreur lors de l'écriture dans le fichier config.json :",
          err,
        );
        message.channel.send(
          "Une erreur s'est produite lors du retrait de l'wl. Veuillez réessayer.",
        );
      } else {
        message.channel.send(`wl retiré avec succès: ${mention}.`);
      }
    });
  }

  if (command === "wllist") {
    // Lire la liste des wls depuis le fichier config.json
    const wls = config.wl;

    // Vérifier si la liste des wls est vide
    if (!wls || wls.length === 0) {
      message.channel.send("La liste des wls est vide.");
      return;
    }

    // Créer un tableau pour stocker les mentions des wls
    let wlMentions = [];

    // Pour chaque ID d'wl dans la liste, mentionner l'utilisateur correspondant
    wls.forEach((wlId) => {
      wlMentions.push(`<@${wlId}>`);
    });

    // Créer un embed contenant la liste des wls
    const embed = new MessageEmbed()
      .setColor("#0099ff")
      .setTitle("Liste des wls")
      .setDescription(`${wlMentions.join("\n")}`)
      .setFooter("⭐ Lookup France");

    // Envoyer l'embed dans le canal
    message.channel.send({ embeds: [embed] });
  }

  if (command === "buyer") {
    // Vérifier si l'utilisateur a la permission d'acheter l'accès
    const userId = message.author.id;
    const owner = config.owner;

    if (!config.owner.includes(message.author.id)) {
      message.channel.send(
        "Vous n'avez pas la permission d'exécuter cette commande.",
      );
      return;
    }

    // Extraire l'ID de l'utilisateur spécifié dans l'argument ou mentionné
    let userIdToGrantAccess = "";
    const mention = message.mentions.users.first();
    if (mention) {
      userIdToGrantAccess = mention.id;
    } else {
      userIdToGrantAccess = args[0];
    }

    // Vérifier si un ID d'utilisateur est spécifié
    if (!userIdToGrantAccess) {
      message.channel.send("Vous devez mentionner l'utilisateur.");
      return;
    }

    // Vérifier si l'ID de l'utilisateur est valide
    if (!client.users.cache.has(userIdToGrantAccess)) {
      message.channel.send("Utilisateur invalide.");
      return;
    }

    // Extraire la durée spécifiée
    const duration = args[1];
    if (!duration) {
      message.channel.send(
        `Vous devez spécifier la durée de l\'accès. Exemple : \`${prefix}buyer <mention> 30d\``,
      );
      return;
    }

    // Convertir la durée en jours
    let days = 0;
    const durationRegex = /^(\d+)d$/;
    const match = duration.match(durationRegex);
    if (match) {
      days = parseInt(match[1]);
    } else {
      message.channel.send(
        "Format de durée invalide. Utilisez le format 1d, 365d etc...",
      );
      return;
    }

    // Enregistrer l'accès pour l'utilisateur spécifié
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + days); // Accès pour le nombre de jours spécifié

    accessData[userIdToGrantAccess] = { expires: expirationDate };
    fs.writeFile(accessFilePath, JSON.stringify(accessData, null, 2), (err) => {
      if (err) console.error("Erreur lors de la sauvegarde des accès :", err);
    });

    message.channel.send(
      `L'acces à été donné a ${userIdToGrantAccess} pour ${days} jours.`,
    );
  }

  if (command === "user") {
    const userId = args[0];
    if (!userId) {
      message.channel.send(`Utilisation: ${prefix}user <ID Discord>`);
      return;
    }

    const member = await client.users.fetch(userId).catch(() => null);
    if (!member) {
      message.channel.send("Impossible de trouver cet utilisateur.");
      return;
    }

    const infoEmbed = new MessageEmbed()
      .setColor("#0099ff")
      .setTitle(`Profil Utilisateur`)
      .setThumbnail(member.displayAvatarURL({ dynamic: true }))
      .setFooter("⭐ Lookup France");

    let notes = [];

    if (noteData[userId]) {
      noteData[userId].forEach((note) => {
        notes.push(note);
      });
    }

    if (notes.length > 0) {
      infoEmbed.addField("Note", notes.join("\n"));
    } else {
      infoEmbed.addField("Note", "❧ Aucune note");
    }

    infoEmbed.addField("Nom d'utilisateur", member.username);
    infoEmbed.addField("ID", userId);
    infoEmbed.addField(
      "Date de création du compte",
      member.createdAt.toUTCString(),
    );
    message.channel.send({ embeds: [infoEmbed] });

    if (userData[userId] && userData[userId].length > 0) {
      const linkEmbed = new MessageEmbed()
        .setColor("#0099ff")
        .setTitle(`Informations liées à ${member.username}`)
        .setFooter("⭐ Lookup France");

      userData[userId].forEach((info) => {
        linkEmbed.setDescription(`__${info.type}__ : ${info.value}`);
      });
      message.channel.send({ embeds: [linkEmbed] });
    } else {
      message.channel.send("Aucune information trouvée pour cet utilisateur.");
    }
  }
});

const createImageEmbed = (imageUrl) => {
  const embed = new MessageEmbed()
    .setColor("#0099ff")
    .setTitle("Image :")
    .setImage(imageUrl)
    .setFooter("⭐ Lookup France");
  return embed;
};

function saveData() {
  fs.writeFileSync(infoFilePath, JSON.stringify(userData, null, 2));
}

function saveNoteData() {
  fs.writeFileSync(noteFilePath, JSON.stringify(noteData, null, 2));
}

function hasAccess(userId) {
  // Vérifier si l'utilisateur a acheté l'accès
  const accessInfo = accessData[userId];
  if (accessInfo && new Date(accessInfo.expires) > new Date()) {
    return true; // L'utilisateur a acheté l'accès et l'accès est encore valide
  } else {
    return false; // L'utilisateur n'a pas acheté l'accès ou l'accès a expiré
  }
}

client.login(token);

// Votre code Discord.js ici

client.on("messageCreate", async (message) => {
  // Votre code de gestion des messages ici
});

// Exemple d'utilisation de la variable days (à adapter selon votre logique)
const days = 7; // Assurez-vous que la variable `days` est définie avant de l'utiliser

// Enregistrer l'accès pour l'utilisateur spécifié
const expirationDate = new Date();
expirationDate.setDate(expirationDate.getDate() + days); // Accès pour le nombre de jours spécifié

accessData[userIdToGrantAccess] = { expires: expirationDate };
fs.writeFile(accessFilePath, JSON.stringify(accessData, null, 2), (err) => {
  if (err) console.error("Erreur lors de la sauvegarde des accès :", err);
});

message.channel.send(
  `L'acces à été donné a ${userIdToGrantAccess} pour ${days} jours.`,
);


// Démarrez le serveur Express pour garder le bot actif
import './keep_alive.js';

