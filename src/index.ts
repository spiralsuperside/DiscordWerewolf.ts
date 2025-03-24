import * as Discord from "discord.js";
import * as fs from "fs"
import * as argv from "argv"
import {isValid, JsonRuntimeType, validate} from 'ts-json-validator';
import {LangTypeFormat, LangType, RuleType, ServerSettingsFormat} from "./JsonType";
import GameState from "./GameState"
import {GameChannels, isThisCommand, loadAndSetSysRuleSet} from "./GameUtils"
import {HttpServer} from "./HttpServer"
import { Guild, Permissions, TextChannel, VoiceChannel } from 'discord.js';
const JSON5 = require('json5');
const util = require('util');


argv.option([
    {
        name:  'server_setting',
        short: 's',
        type: 'list,path',
        description :'Specify the location of your own server configuration file.',
        example: "'-s local_private/my_server_settings.json5'"
    }
]);
const arg = argv.run();


const ServerSetting = loadAndSetServerSetting('./server_settings/default.json5', arg.options["server_setting"]);
// console.log("ServerSetting", ServerSetting)

const SysLangTxt = loadAndSetSysLangTxt("./lang/" + ServerSetting.system_lang + ".json5");
const SysRuleSet = loadAndSetSysRuleSet("./rule_setting_templates/default.json5");

if (SysLangTxt    == null) { throw new Error('SysLangTxt is Wrong! lang:' + ServerSetting.system_lang);}
if (SysRuleSet    == null) { throw new Error('SysRuleSet is Wrong!');}

const clients = [
    new Discord.Client({ intents: ['GUILD_MESSAGES', 'GUILD_MESSAGE_REACTIONS', 'GUILD_VOICE_STATES', 'GUILDS'] }), 
    new Discord.Client({ intents: ['GUILD_MESSAGES', 'GUILD_MESSAGE_REACTIONS', 'GUILD_VOICE_STATES', 'GUILDS'] })];

const Games: { [key: string]: GameState; } = {};


clients[0].on("ready", () => {console.log("Login! ", clients[0].user ? clients[0].user.username : "");});
clients[1].on("ready", () => {console.log("Login! ", clients[1].user ? clients[1].user.username : "");});


const httpServer : HttpServer = new HttpServer(ServerSetting, SysLangTxt);

function loadAndSetSysLangTxt(path : string, LangTxt ?: LangType){
    const data = fs.readFileSync(path, 'utf-8');
    const json5 = JSON5.parse(data);
    try {
        const ret = validate(LangTypeFormat, json5);
        if(ret != null) LangTxt = ret;
        return ret;
    } catch (e) {
        console.log(e);
    }
}


function get_env(str : string){
    let res = "";
    if(str.startsWith('$')){
        str = str.substring(1);
        if(!(str in process.env)) throw new Error("Env " + str + " doesn't exist!");
        const e = process.env[str];
        if(e == null) throw new Error("Env " + str + "doesn't exist!");
        res = e;
    } else {
        res = str.substring(1)
    }
    return res;
}

function isValidJsonRuntimeType(runtimeType: JsonRuntimeType, obj: any): boolean {
    switch (runtimeType) {
    case 'null':
        if(obj === null) return true;
        break;
    case 'boolean':
    case 'number':
    case 'string':
        if(typeof obj === runtimeType) return true;
        break;
    default:
        switch (runtimeType.base) {
        case 'literal':
            if(obj === runtimeType.value) return true;
            break;
        case 'optional':
            if(obj === undefined) return true;
            if(isValid(runtimeType.element, obj)) return true;
            break;
        case "union":
            if(runtimeType.elements.some((t) => isValid(t, obj))) return true;
            break;
        case "array":
            if(obj instanceof Array && obj.every((e) => isValid(runtimeType.element, e))) return true;
            break;
        case "tuple":
            const res = obj instanceof Array &&
                runtimeType.elements.length === obj.length &&
                runtimeType.elements.every((typ, i) => isValid(typ, obj[i]));
            if(res) return true;
            break;
        case "object":
            if (obj === null || typeof obj !== 'object') {
            } else if(Object.entries(runtimeType.keyValues).every(([key, typ]) => isValidJsonRuntimeType(typ, obj[key]))){
                return true;
            }
            break;
        }
    }
    console.error("runtimeType :", runtimeType);
    console.error("obj type    :", typeof obj);
    console.error("obj         :", obj);
    throw new Error("Json Type parse error!!");
}


function loadAndSetServerSetting(default_path : string, server_setting_files : any){
    var files : string[] = [default_path];
    if(server_setting_files instanceof Array){
        for(const f of server_setting_files){
            if(typeof f !== 'string') continue;
            files.push(f);
        }
    }
    let resTmp : any = new Object();
    for(const path of files){
        const rawFile = fs.readFileSync(path, 'utf-8');
        const jsonObj = JSON5.parse(rawFile);
        Object.assign(resTmp, jsonObj);
        resTmp = validate(ServerSettingsFormat, resTmp);
        if (resTmp == null) { 
            isValidJsonRuntimeType(ServerSettingsFormat.runtimeType, resTmp);
            throw new Error('ServerSetting is Wrong! File : ' + path);
        }
    }
    let res = validate(ServerSettingsFormat, resTmp);
    if (res == null) throw new Error('ServerSetting is Wrong!');
    res.token1 = get_env(res.token1);
    res.token2 = get_env(res.token2);
    res.http.addr = get_env(res.http.addr);
    res.http.ip        = get_env(res.http.ip);
    res.http.http_port = get_env(res.http.http_port);
    let GMs : string[] = [];
    for(const s of res.system_GM){
        const t = get_env(s).split(' ');
        GMs = GMs.concat(t);
    }
    res.system_GM = GMs;
    return res;
}

function has_room_all_game_channel_support_t(
    catId : string, 
    find_name : string, 
    channels : Discord.GuildChannelManager) : Discord.TextChannel | null{
    var ret : Discord.TextChannel | null  = null;
    const targetChannel = channels.cache.find(c => (c.parentId == catId && c.name == find_name));
    if(targetChannel == null) return null;
    if (!((targetChannel): targetChannel is Discord.TextChannel => targetChannel.type === 'GUILD_TEXT')(targetChannel)) return null;
    return targetChannel;
}
function has_room_all_game_channel_support_v(
    catId : string, 
    find_name : string, 
    channels : Discord.GuildChannelManager) : Discord.VoiceChannel | null{
    var ret : Discord.VoiceChannel | null  = null;
    const targetChannel = channels.cache.find(c => (c.parentId == catId && c.name == find_name));
    if(targetChannel == null) return null;
    if (!((targetChannel): targetChannel is Discord.VoiceChannel => targetChannel.type === 'GUILD_VOICE')(targetChannel)) return null;
    return targetChannel;
}

function has_room_all_game_channel(catId : string, channels : Discord.GuildChannelManager, SrvLangTxt : LangType) : GameChannels | null{
    const aLivingVoice = has_room_all_game_channel_support_v(catId, SrvLangTxt['game']["room_LivingVoice"], channels); if(aLivingVoice == null) return null;
    const aDeadVoice   = has_room_all_game_channel_support_v(catId, SrvLangTxt['game']["room_DeadVoice"]  , channels); if(aDeadVoice   == null) return null;
    const aWerewolf    = has_room_all_game_channel_support_t(catId, SrvLangTxt['game']["room_Werewolf"]   , channels); if(aWerewolf    == null) return null;
    const aGameLog     = has_room_all_game_channel_support_t(catId, SrvLangTxt['game']["room_GameLog"]    , channels); if(aGameLog     == null) return null;
    const aDebugLog    = has_room_all_game_channel_support_t(catId, SrvLangTxt['game']["room_DebugLog"]   , channels); if(aDebugLog    == null) return null;
    const aLiving      = has_room_all_game_channel_support_t(catId, SrvLangTxt['game']["room_Living"]     , channels); if(aLiving      == null) return null;
    const aDead        = has_room_all_game_channel_support_t(catId, SrvLangTxt['game']["room_Dead"]       , channels); if(aDead        == null) return null;
    return new GameChannels(
        aWerewolf   ,
        aGameLog    ,
        aDebugLog   ,
        aLiving     ,
        aLivingVoice,
        aDead       ,
        aDeadVoice
    );
}

function getGameChannels2(ch : GameChannels, gch : Discord.GuildChannelManager) : GameChannels | null{
    let aWerewolf    : Discord.TextChannel  | null = null;
    let aGameLog     : Discord.TextChannel  | null = null;
    let aDebugLog    : Discord.TextChannel  | null = null;
    let aLiving      : Discord.TextChannel  | null = null;
    let aLivingVoice : Discord.VoiceChannel | null = null;
    let aDead        : Discord.TextChannel  | null = null;
    let aDeadVoice   : Discord.VoiceChannel | null = null;
    gch.cache.forEach(function (c, key) {
        if(ch.Werewolf   .id == c.id && ((c): c is Discord.TextChannel => c.type === 'GUILD_TEXT')(c)) aWerewolf    = c;
        if(ch.GameLog    .id == c.id && ((c): c is Discord.TextChannel => c.type === 'GUILD_TEXT')(c)) aGameLog     = c;
        if(ch.DebugLog   .id == c.id && ((c): c is Discord.TextChannel => c.type === 'GUILD_TEXT')(c)) aDebugLog    = c;
        if(ch.Living     .id == c.id && ((c): c is Discord.TextChannel => c.type === 'GUILD_TEXT')(c)) aLiving      = c;
        if(ch.LivingVoice.id == c.id && ((c): c is Discord.VoiceChannel=> c.type === 'GUILD_VOICE')(c))aLivingVoice = c;
        if(ch.Dead       .id == c.id && ((c): c is Discord.TextChannel => c.type === 'GUILD_TEXT')(c)) aDead        = c;
        if(ch.DeadVoice  .id == c.id && ((c): c is Discord.VoiceChannel=> c.type === 'GUILD_VOICE')(c))aDeadVoice   = c;
    });
    if(aWerewolf   == null) return null;
    if(aGameLog    == null) return null;
    if(aDebugLog   == null) return null;
    if(aLiving     == null) return null;
    if(aLivingVoice== null) return null;
    if(aDead       == null) return null;
    if(aDeadVoice  == null) return null;
    return new GameChannels(
        aWerewolf   ,
        aGameLog    ,
        aDebugLog   ,
        aLiving     ,
        aLivingVoice,
        aDead       ,
        aDeadVoice
    );
}


async function make_room(message: Discord.Message, SrvLangTxt: LangType) {
    const guild: Guild | null = message.guild;
    if (!guild) return;

    await message.channel.send(SrvLangTxt.p0.make_room);

    const category_name = "⭐ 人狼ゲーム";

    let Werewolf: TextChannel | null = null;
    let GameLog: TextChannel | null = null;
    let DebugLog: TextChannel | null = null;
    let Living: TextChannel | null = null;
    let LivingVoice: VoiceChannel | null = null;
    let Dead: TextChannel | null = null;
    let DeadVoice: VoiceChannel | null = null;

    const allowedRoles: string[] = [
        "1347778787550433390",
        "1351216161089654848",
        "1351216402119266385"
    ];

    // Create category with correct permissions
    const cat = await guild.channels.create(category_name, {
        type: 'GUILD_CATEGORY',
        permissionOverwrites: [
            {
                id: guild.roles.everyone.id, // Deny @everyone
                deny: [Permissions.FLAGS.VIEW_CHANNEL]
            },
            ...allowedRoles.map(roleId => ({
                id: roleId,
                allow: [Permissions.FLAGS.VIEW_CHANNEL]
            }))
        ]
    });

    // Helper function to create channels with restricted permissions
    async function createRestrictedChannel(name: string, type: 'GUILD_TEXT' | 'GUILD_VOICE', position: number) {
        return await guild!.channels.create(name, {
            type,
            parent: cat.id,
            position,
            permissionOverwrites: [
                {
                    id: guild!.roles.everyone.id, // Deny @everyone
                    deny: [Permissions.FLAGS.VIEW_CHANNEL]
                },
                ...allowedRoles.map(roleId => ({
                    id: roleId,
                    allow: [
                        Permissions.FLAGS.VIEW_CHANNEL,
                        ...(type === 'GUILD_TEXT' ? [Permissions.FLAGS.SEND_MESSAGES] : []),
                        ...(type === 'GUILD_VOICE' ? [Permissions.FLAGS.CONNECT, Permissions.FLAGS.SPEAK] : [])
                    ]
                }))
            ]
        });
    }

    // Create text and voice channels
    Werewolf    = await createRestrictedChannel(SrvLangTxt.game.room_Werewolf, 'GUILD_TEXT', 2) as TextChannel;
    GameLog     = await createRestrictedChannel(SrvLangTxt.game.room_GameLog, 'GUILD_TEXT', 3) as TextChannel;
    DebugLog    = await createRestrictedChannel(SrvLangTxt.game.room_DebugLog, 'GUILD_TEXT', 4) as TextChannel;
    Living      = await createRestrictedChannel(SrvLangTxt.game.room_Living, 'GUILD_TEXT', 5) as TextChannel;
    LivingVoice = await createRestrictedChannel(SrvLangTxt.game.room_LivingVoice, 'GUILD_VOICE', 6) as VoiceChannel;
    Dead        = await createRestrictedChannel(SrvLangTxt.game.room_Dead, 'GUILD_TEXT', 7) as TextChannel;
    DeadVoice   = await createRestrictedChannel(SrvLangTxt.game.room_DeadVoice, 'GUILD_VOICE', 8) as VoiceChannel;

    return new GameChannels(Werewolf, GameLog, DebugLog, Living, LivingVoice, Dead, DeadVoice);
}


async function on_message(bid : number, message : Discord.Message){
    if (clients[0].user == null || message.author.id == clients[0].user.id) return;
    if (clients[1].user == null || message.author.id == clients[1].user.id) return;
    if (message.content.startsWith('^ping1')) {
        if(bid == 0) message.channel.send("pong 1!");
        return;
    }
    if (message.content.startsWith('^ping2')) {
        if(bid == 1) message.channel.send("pong 2!");
        return;
    }
    if (message.content.startsWith('^ping')) {
        message.channel.send("pong!"); return;
    }
    if (message.content.startsWith("^close")) {
        const guild = message.guild;
        if (!guild) return;

        try {
	    const allChannels = guild.channels.cache;
            // Find the category that contains "人狼ゲーム"
            allChannels.forEach(channel => {
                if (channel.type === "GUILD_CATEGORY") {
                console.log(`- ${channel.name} (ID: ${channel.id})`);
                }
            });
    
            const category = allChannels.find(
                (channel): channel is Discord.CategoryChannel =>
                    channel !== null &&
                    channel.type === "GUILD_CATEGORY" &&
                    typeof channel.name === "string" &&
                    channel.name.includes("人狼ゲーム")
            );

            if (!category) {
                message.channel.send("Category '⭐ 人狼ゲーム' not found.");
                console.log(`Category "⭐ 人狼ゲーム" not found.`);
                return;
            }

            // Fetch and delete all channels inside the category
            const channelsToDelete = allChannels.filter(
                (channel): channel is Discord.TextChannel | Discord.VoiceChannel =>
                    channel !== null && channel.parentId === category.id
            );

            if (channelsToDelete.size === 0) {
                message.channel.send("No channels found in category '⭐ 人狼ゲーム'.");
                console.log(`No channels found in category "⭐ 人狼ゲーム"`);
                return;
            }

            console.log(
                "Filtered Channels in Category:",
                [...channelsToDelete.values()].map((c) => c?.name || "Unknown")
            );

            for (const channel of channelsToDelete.values()) {
                if (!channel) continue; // Ensure channel is not null before deleting
                try {
                    await channel.delete();
                    //console.log(`Deleted channel: ${channel.name}`);
                } catch (error) {
                    console.error(`Failed to delete channel ${channel.name}:`, error);
                }
            }

            // Optional: Delete the category itself after clearing its channels
            try {
                await category.delete();
                //console.log(`Deleted category: ${category.name}`);
            } catch (error) {
                console.error(`Failed to delete category:`, error);
            }
        } catch (error) {
            console.error(`Error in ^close function:`, error);
        }
        return;
    }
    if(bid == 1) return;
    // console.log("text > ", message.content);
    
    const message_channel = message.channel;
    console.log(SysLangTxt, SysRuleSet);
    console.log(message_channel);

    if(SysLangTxt != null && SysRuleSet != null && ('parentId' in message_channel)){
        const SrvLangTxt : LangType = SysLangTxt;
        const SrvRuleSet : RuleType = SysRuleSet;
        const paID = message_channel.parentId;

        if(paID != null){
            if(Object.keys(Games).find((v : string ) => v == paID) != null){
                await Games[paID].command(message);
                return;
            }
            const u = clients[0].user;
	    console.log('a');
            if(message.guild && message.mentions.users.find(mu => mu.id == u.id)){
		    console.log('b');
                const guild1 = message.guild;
                const ch = has_room_all_game_channel(paID, guild1.channels, SrvLangTxt)
                if(ch != null){
			console.log('c');
                    let guild2 = clients[1].guilds.cache.find(g => g.id == guild1.id);
                    if(guild2 != null){
			    console.log('d');
                        const ch2 = getGameChannels2(ch, guild2.channels);
                        if(ch2 != null){
				console.log('e');
                            Games[paID] = new GameState(clients, Games, message.guild, guild2, ch, ch2, paID, httpServer, SrvLangTxt, SrvRuleSet, ServerSetting);
                            ch.Living.send(SrvLangTxt.p0.rediscovered_room)
                            // console.trace("再認識");
                            Games[paID].start_1Wanted();
                            await Games[paID].command(message);
                            if(ServerSetting.auto_voice_link){
                                const sleep = (msec : number) => new Promise(resolve => setTimeout(resolve, msec));
                                await sleep(300);
                                Games[paID].voiceChannelsLink();
                            }
                        }
                        return
                    }
                }
            }
        }
	console.log('f');
        if(isThisCommand(message.content, SrvLangTxt.sys.cmd_make_room) >= 0){
		console.log('g');
            const u = clients[0].user;
	    console.log(message.mentions, u);
            if(message.mentions.users.find(mu => mu.id == u.id) == null) return;
	    console.log('h');
            const guild1_old = message.guild;
            if (guild1_old == null) return;
	    console.log('i');
            
            const ch = await make_room(message, SrvLangTxt);
            const guild1 = await guild1_old.fetch();
            if(guild1 == null) return;
	    console.log('j');
            let guild2 = clients[1].guilds.cache.find(g => g.id == guild1.id);
            if(guild2 != null) guild2 = await guild2.fetch();
            if(ch == null || guild2 == null) return;
	    console.log('k');
            const pa = ch.Living.parentId;
            const ch2 = getGameChannels2(ch, guild2.channels);
            if(pa == null || ch2 == null) return;
	    console.log('l');
            Games[pa] = new GameState(clients, Games, guild1, guild2, ch, ch2, pa, httpServer, SrvLangTxt, SrvRuleSet, ServerSetting);
            Games[pa].updateRoomsRW();
            ch.Living.send("<@!" + message.author.id + "> done!");
            Games[pa].start_1Wanted();
	    console.log('m');
            if(ServerSetting.auto_voice_link){
                Games[pa].voiceChannelsLink();
            }
            return
        }
    }
}


clients[0].on("messageCreate", async message => await on_message(0, message));
clients[1].on("messageCreate", async message => await on_message(1, message));

clients[0].on('interactionCreate', async (interaction) => {
    if (clients[0].user == null) return;
    if (clients[1].user == null) return;
    if (!interaction.isButton()) return;

    // TODO
    const pid = Object.keys(Games).find( key => {
        if (Games[key].guild.id != interaction.guildId) return false;
        if (Games[key].channels.Living.id == interaction.channelId) return true;
        if (Games[key].channels.Werewolf.id == interaction.channelId) return true;
        return Object.keys(Games[key].members).find( uid => {
            const uch = Games[key].members[uid].uchannel;
            if (uch == null) return false;
            return (uch.id == interaction.channelId);
        });
    });
    if (pid == null) return;
    await Games[pid].interactCommand(interaction);
});


const token1 = ServerSetting.token1;
const token2 = ServerSetting.token2;

clients[0].login(token1)
clients[1].login(token2)
