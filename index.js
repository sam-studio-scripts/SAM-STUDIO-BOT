require("dotenv").config();
const {
    Client,
    GatewayIntentBits,
    Partials,
    PermissionsBitField,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    REST,
    Routes,
    SlashCommandBuilder,
    Events,
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    MediaGalleryBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    LabelBuilder,
    FileUploadBuilder
} = require("discord.js");
const fs = require("fs");
const http = require("http");

// ================= CONFIG & ENV =================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = "1536547186962333777";
const PANEL_CHANNEL_ID = "1526597563736916028";
const STAFF_ROLE_ID = "1526597468861763825";
const LEGACY_STAFF_ROLE_ID = "686569170330058753";
const VERIFIED_ROLE_ID = "1526597473970294914";
const WELCOME_CHANNEL_ID = "1526597511228166267";
const GOODBYE_CHANNEL_ID = "1536548597078691950";
const CLOSED_CATEGORY_ID = "1544914321090543626";

// Log Channels
const LOG_CHANNELS = {
    MOD: "1536548714297032794",
    TICKET: "1544912522874851448",
    MSG: "1544912711664664586",
    VC: "1544912908084056114",
    JOIN: process.env.JOIN_LEAVE_LOGS,
    ROLE: "1544912807303192576",
    SERVER: process.env.SERVER_LOGS,
    INVITE: "1544913016426991726",
    NICKNAME: "1544913108638629960"
};

// ================= TICKET CATEGORIES =================
// Agar .env me IDs nahi doge to bot khud category
// name se find/create kar dega.

const CATEGORY_IDS = {
    pre_purchase: "1544913384695402496",
    script_support: "1531650428322971769",
    partners: "1544914210524241970"
};

const CATEGORY_NAMES = {
    pre_purchase: "Pre-purchase Questions",
    script_support: "Script Support",
    partners: "Partners"
};

const TICKET_LABELS = {
    pre_purchase: "Pre-purchase Questions",
    script_support: "Script Support",
    partners: "Partners"
};

const TICKET_DESCRIPTIONS = {
    pre_purchase:
        "Need details before purchase? Our team is here to guide you anytime.",
    script_support:
        "Get script support, bug fixes, and guidance from our staff anytime.",
    partners:
        "Discover our trusted partners and amazing communities. Check out their projects and support them!"
};

// Emojis
const EMOJIS = {
    pre_purchase: "❓",
    script_support: "🔧",
    partners: "🌟"
};

const TICKET_PANEL_DESCRIPTION =
    "1. Do not tag, ping, or DM unless requested.\n" +
    "2. No hate speech, bullying, or discrimination of any kind.\n" +
    "3. Select the correct category when opening tickets.\n" +
    "4. No support for leaked, stolen, or resold scripts.\n\n" +
    "**Select a category below to open a ticket.**";

// ================= DATA STORES =================
let warnings = {};
let antiSpamChannels = new Set();
let antiLinkChannels = new Set();
let antiMentionChannels = new Set();
let activeGiveaways = new Map();
let invites = new Map();

// ================= ANTI PING =================
const ANTI_PING_MEMBERS = new Set();
const ANTI_PING_ROLE_ID = "1215053255416217612";
const antiPingAttempts = new Map();

// ================= CLIENT =================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildModeration
    ],
    partials: [
        Partials.Channel,
        Partials.GuildMember,
        Partials.User
    ],
});

// ================= HELPER =================
async function sendLog(guild, channelId, embed) {
    if (!channelId) return;

    const channel = guild.channels.cache.get(channelId);

    if (channel) {
        channel.send({
            embeds: [embed]
        }).catch(() => {});
    }
}

function isValidHttpUrl(value) {
    if (!value) return false;

    try {
        const url = new URL(value);
        return url.protocol === "https:" || url.protocol === "http:";
    } catch (e) {
        return false;
    }
}

function parseMessageButtons(rawValue) {
    const lines = String(rawValue || "")
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

    if (lines.length > 5) {
        throw new Error("Maximum 5 buttons are allowed.");
    }

    return lines.map((line, index) => {
        const separatorIndex = line.indexOf("|");

        if (separatorIndex === -1) {
            throw new Error(
                `Button ${index + 1}: use Button Name | https://link.com`
            );
        }

        const label = line.slice(0, separatorIndex).trim();
        const url = line.slice(separatorIndex + 1).trim();

        if (!label || label.length > 80) {
            throw new Error(
                `Button ${index + 1}: name must be between 1 and 80 characters.`
            );
        }

        if (!isValidHttpUrl(url) || url.length > 512) {
            throw new Error(
                `Button ${index + 1}: enter a valid http:// or https:// link.`
            );
        }

        return {
            label,
            url
        };
    });
}

function isStaffMember(member) {
    return Boolean(
        member?.roles?.cache?.has(STAFF_ROLE_ID) ||
        member?.permissions?.has(
            PermissionsBitField.Flags.Administrator
        )
    );
}

async function syncTicketStaffPermissions(guild) {
    const ticketChannels =
        guild.channels.cache.filter(channel =>
            channel.type === ChannelType.GuildText &&
            channel.topic?.includes("sam-ticket-user:")
        );

    for (const [, channel] of ticketChannels) {
        await channel.permissionOverwrites.edit(
            STAFF_ROLE_ID,
            {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                AttachFiles: true,
                EmbedLinks: true
            }
        ).catch(error => {
            console.error(
                `Could not update staff access for ${channel.name}:`,
                error.message
            );
        });

        if (
            LEGACY_STAFF_ROLE_ID &&
            LEGACY_STAFF_ROLE_ID !== STAFF_ROLE_ID
        ) {
            await channel.permissionOverwrites
                .delete(LEGACY_STAFF_ROLE_ID)
                .catch(() => {});
        }
    }

    console.log(
        `Ticket staff permissions synced for ${ticketChannels.size} channel(s) ✅`
    );
}

// ================= TIME PARSER =================
function parseDuration(durationStr) {
    const timeUnits = {
        m: 60000,
        h: 3600000,
        d: 86400000
    };

    const match = durationStr.match(/^(\d+)([mhd])$/i);

    if (!match) return null;

    return parseInt(match[1]) *
        timeUnits[match[2].toLowerCase()];
}

// ================= GET TICKET CATEGORY =================
async function getTicketCategory(guild, type) {

    const fallbackType = "script_support";

    const safeType =
        CATEGORY_NAMES[type]
            ? type
            : fallbackType;

    const configuredId =
        CATEGORY_IDS[safeType];

    // Try configured category ID
    if (configuredId) {

        const configuredCategory =
            guild.channels.cache.get(configuredId) ||
            await guild.channels
                .fetch(configuredId)
                .catch(() => null);

        if (
            configuredCategory &&
            configuredCategory.type === ChannelType.GuildCategory
        ) {
            return configuredCategory;
        }
    }

    const wantedName =
        CATEGORY_NAMES[safeType];

    // Find category by name
    let category =
        guild.channels.cache.find(channel =>
            channel.type === ChannelType.GuildCategory &&
            channel.name.toLowerCase() === wantedName.toLowerCase()
        );

    // Create category if not found
    if (!category) {

        category =
            await guild.channels.create({
                name: wantedName,
                type: ChannelType.GuildCategory
            });
    }

    CATEGORY_IDS[safeType] =
        category.id;

    return category;
}

// ================= CHECK OPEN TICKET =================
async function hasOpenTicket(
    guild,
    userId,
    type
) {

    const category =
        await getTicketCategory(
            guild,
            type
        );

    const member =
        guild.members.cache.get(userId);

    const username =
        member?.user?.username?.toLowerCase() || "";

    return guild.channels.cache.some(channel =>

        channel.type === ChannelType.GuildText &&

        channel.parentId === category.id &&

        !channel.name.startsWith("closed-") &&

        (
            channel.topic?.includes(
                `sam-ticket-user:${userId}`
            )

            ||

            (
                username &&
                channel.name
                    .toLowerCase()
                    .includes(username)
            )
        )
    );
}

// ================= GET TICKET CREATOR =================
async function getTicketCreator(channel) {

    const overwrites =
        channel.permissionOverwrites.cache;

    for (const [, overwrite] of overwrites) {

        if (
            overwrite.type === 1 &&
            overwrite.id !== STAFF_ROLE_ID &&
            overwrite.allow.has(
                PermissionsBitField.Flags.ViewChannel
            )
        ) {

            try {

                return await channel.guild.members.fetch(
                    overwrite.id
                );

            } catch (e) {}
        }
    }

    return null;
}

// =====================================================
// SLASH COMMANDS
// =====================================================

const commands = [

    new SlashCommandBuilder()
        .setName("ticketpanel")
        .setDescription("Send ticket panel"),

    new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Ban a user")
        .addUserOption(o =>
            o.setName("user")
                .setDescription("User")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("reason")
                .setDescription("Reason")
        ),

    new SlashCommandBuilder()
        .setName("kick")
        .setDescription("Kick a user")
        .addUserOption(o =>
            o.setName("user")
                .setDescription("User")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("reason")
                .setDescription("Reason")
        ),

    new SlashCommandBuilder()
        .setName("mute")
        .setDescription("Timeout a user")
        .addUserOption(o =>
            o.setName("user")
                .setDescription("User")
                .setRequired(true)
        )
        .addIntegerOption(o =>
            o.setName("minutes")
                .setDescription("Minutes")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("reason")
                .setDescription("Reason")
        ),

    new SlashCommandBuilder()
        .setName("unmute")
        .setDescription("Remove timeout")
        .addUserOption(o =>
            o.setName("user")
                .setDescription("User")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("warn")
        .setDescription("Warn a user")
        .addUserOption(o =>
            o.setName("user")
                .setDescription("User")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("clear")
        .setDescription("Clear messages")
        .addIntegerOption(o =>
            o.setName("amount")
                .setDescription("Amount")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("msg")
        .setDescription("Open the SAM STUDIO message builder"),

    new SlashCommandBuilder()
        .setName("serverinfo")
        .setDescription("Shows server information"),

    new SlashCommandBuilder()
        .setName("memberinfo")
        .setDescription("Shows member information")
        .addUserOption(o =>
            o.setName("user")
                .setDescription("User")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("giverole")
        .setDescription("Give role to user or all")
        .addStringOption(o =>
            o.setName("roleid")
                .setDescription("Role ID")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("target")
                .setDescription("all or user mention/ID")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("removerole")
        .setDescription("Remove role from user or all")
        .addStringOption(o =>
            o.setName("roleid")
                .setDescription("Role ID")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("target")
                .setDescription("all or user mention/ID")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("giveaway")
        .setDescription("Start a giveaway")
        .addStringOption(o =>
            o.setName("prize")
                .setDescription("Prize for giveaway")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("duration")
                .setDescription("Duration (e.g. 1m, 2h, 1d)")
                .setRequired(true)
        )
        .addIntegerOption(o =>
            o.setName("winners")
                .setDescription("Number of winners")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("invites")
        .setDescription("Check user invites")
        .addUserOption(o =>
            o.setName("user")
                .setDescription("User")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("antiping")
        .setDescription("Manage anti-ping")
        .addStringOption(o =>
            o.setName("action")
                .setDescription("add/remove/list")
                .setRequired(true)
        )
        .addUserOption(o =>
            o.setName("user")
                .setDescription("User to add/remove")
                .setRequired(false)
        ),

].map(cmd => cmd.toJSON());

// =====================================================
// BOT READY
// =====================================================

client.once(
    Events.ClientReady,
    async () => {

        console.log(
            `Logged in as ${client.user.tag}`
        );

        const rest =
            new REST({
                version: "10"
            }).setToken(TOKEN);

        try {

            await rest.put(
                Routes.applicationCommands(
                    CLIENT_ID
                ),
                {
                    body: commands
                }
            );

            console.log(
                "Slash Commands Registered ✅"
            );

        } catch (err) {

            console.error(err);
        }

        // Invite tracker setup

        const guild =
            client.guilds.cache.first();

        if (guild) {

            await syncTicketStaffPermissions(
                guild
            );

            try {

                const guildInvites =
                    await guild.invites.fetch();

                guildInvites.forEach(
                    invite =>
                        invites.set(
                            invite.code,
                            invite.uses
                        )
                );

                console.log(
                    "Invite Tracker Initialized ✅"
                );

            } catch (e) {}
        }
    }
);

// =====================================================
// INTERACTION HANDLER
// =====================================================

client.on(
    "interactionCreate",
    async (interaction) => {

        try {

            // =================================================
            // SLASH COMMANDS
            // =================================================

            if (
                interaction.isChatInputCommand()
            ) {

                const cmd =
                    interaction.commandName;

                // ================= ANTI PING =================

                if (cmd === "antiping") {

                    if (
                        !interaction.member.permissions.has(
                            PermissionsBitField.Flags.Administrator
                        )
                    ) {

                        return interaction.reply({
                            content:
                                "❌ Administrator permission required!",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const action =
                        interaction.options.getString(
                            "action"
                        );

                    const user =
                        interaction.options.getUser(
                            "user"
                        );

                    if (
                        action === "add" &&
                        user
                    ) {

                        ANTI_PING_MEMBERS.add(
                            user.id
                        );

                        return interaction.reply({
                            content:
                                `✅ ${user.tag} added to anti-ping list.`,
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        action === "remove" &&
                        user
                    ) {

                        ANTI_PING_MEMBERS.delete(
                            user.id
                        );

                        return interaction.reply({
                            content:
                                `✅ ${user.tag} removed from anti-ping list.`,
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (action === "list") {

                        const list =
                            ANTI_PING_MEMBERS.size > 0

                                ? Array.from(
                                    ANTI_PING_MEMBERS
                                )
                                    .map(
                                        id =>
                                            `<@${id}>`
                                    )
                                    .join("\n")

                                : "Empty";

                        return interaction.reply({
                            content:
                                `**Anti-Ping Members:**\n${list}`,
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    return interaction.reply({
                        content:
                            "Invalid usage!",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                // =================================================
                // TICKET PANEL
                // =================================================

                if (cmd === "ticketpanel") {

                    if (
                        interaction.channelId !==
                        PANEL_CHANNEL_ID
                    ) {

                        return interaction.reply({
                            content:
                                "Wrong channel ♻️",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const embed =
                        new EmbedBuilder()

                            .setTitle(
                                "🎟️ Ticket & Support"
                            )

                            .setColor(
                                0x2b2d31
                            )

                            .setDescription(
                                TICKET_PANEL_DESCRIPTION
                            );

                    const select =
                        new StringSelectMenuBuilder()

                            .setCustomId(
                                "ticket_select"
                            )

                            .setPlaceholder(
                                "Select ticket type"
                            )

                            .addOptions(
                                Object.keys(TICKET_LABELS)
                                    .map(type => ({
                                        label:
                                            TICKET_LABELS[type],
                                        description:
                                            TICKET_DESCRIPTIONS[type],
                                        emoji:
                                            EMOJIS[type],
                                        value:
                                            type
                                    }))
                            );

                    return interaction.reply({

                        embeds: [
                            embed
                        ],

                        components: [
                            new ActionRowBuilder()
                                .addComponents(
                                    select
                                )
                        ]
                    });
                }

                // ================= INVITES =================

                if (cmd === "invites") {

                    const target =
                        interaction.options.getMember(
                            "user"
                        ) ||
                        interaction.member;

                    const embed =
                        new EmbedBuilder()

                            .setTitle(
                                `📊 Invite Stats - ${target.user.tag}`
                            )

                            .setColor(
                                0x2b2d31
                            )

                            .setDescription(
                                "Invite tracking is active.\nFull detailed stats coming soon."
                            )

                            .setThumbnail(
                                target.user.displayAvatarURL({
                                    dynamic: true
                                })
                            );

                    return interaction.reply({
                        embeds: [
                            embed
                        ]
                    });
                }

                // ================= GIVEAWAY =================

                if (cmd === "giveaway") {

                    if (
                        !interaction.member.permissions.has(
                            PermissionsBitField.Flags.ManageGuild
                        )
                    ) {

                        return interaction.reply({
                            content:
                                "No Permission!",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const prize =
                        interaction.options.getString(
                            "prize"
                        );

                    const durationStr =
                        interaction.options.getString(
                            "duration"
                        );

                    const winnersCount =
                        interaction.options.getInteger(
                            "winners"
                        );

                    const durationMs =
                        parseDuration(
                            durationStr
                        );

                    if (!durationMs) {

                        return interaction.reply({
                            content:
                                "❌ Invalid duration format! Use: 1m, 2h, 1d etc.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const embed =
                        new EmbedBuilder()

                            .setTitle(
                                "🎉 **GIVEAWAY** 🎉"
                            )

                            .setColor(
                                "#00FF00"
                            )

                            .setDescription(
                                `**Prize:** ${prize}\n**Winners:** ${winnersCount}\n**Ends in:** ${durationStr}`
                            )

                            .setFooter({
                                text:
                                    `Hosted by ${interaction.user.tag}`
                            })

                            .setTimestamp();

                    const msg =
                        await interaction.channel.send({
                            embeds: [
                                embed
                            ]
                        });

                    await msg.react(
                        "🎉"
                    );

                    const giveawayData = {

                        messageId:
                            msg.id,

                        channelId:
                            interaction.channel.id,

                        prize:
                            prize,

                        winners:
                            winnersCount,

                        endTime:
                            Date.now() +
                            durationMs
                    };

                    activeGiveaways.set(
                        msg.id,
                        giveawayData
                    );

                    setTimeout(
                        () =>
                            endGiveaway(
                                msg.id
                            ),
                        durationMs
                    );

                    return interaction.reply({
                        content:
                            "✅ Giveaway started!",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                // ================= BAN =================

                if (cmd === "ban") {

                    if (
                        !interaction.member.permissions.has(
                            PermissionsBitField.Flags.BanMembers
                        )
                    ) {

                        return interaction.reply({
                            content:
                                "No Permission!",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const target =
                        interaction.options.getMember(
                            "user"
                        );

                    const reason =
                        interaction.options.getString(
                            "reason"
                        ) ||
                        "No reason";

                    if (!target) {

                        return interaction.reply({
                            content:
                                "❌ User not found.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    await target.ban({
                        reason
                    });

                    const log =
                        new EmbedBuilder()

                            .setColor(
                                "#FF0000"
                            )

                            .setTitle(
                                "Member Banned"
                            )

                            .addFields(

                                {
                                    name:
                                        "Target",
                                    value:
                                        target.user.tag
                                },

                                {
                                    name:
                                        "Moderator",
                                    value:
                                        interaction.user.tag
                                },

                                {
                                    name:
                                        "Reason",
                                    value:
                                        reason
                                }
                            )

                            .setTimestamp();

                    await sendLog(
                        interaction.guild,
                        LOG_CHANNELS.MOD,
                        log
                    );

                    return interaction.reply(
                        `✅ Banned ${target.user.tag}`
                    );
                }

                // ================= KICK =================

                if (cmd === "kick") {

                    if (
                        !interaction.member.permissions.has(
                            PermissionsBitField.Flags.KickMembers
                        )
                    ) {

                        return interaction.reply({
                            content:
                                "No Permission!",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const target =
                        interaction.options.getMember(
                            "user"
                        );

                    const reason =
                        interaction.options.getString(
                            "reason"
                        ) ||
                        "No reason";

                    if (!target) {

                        return interaction.reply({
                            content:
                                "❌ User not found.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    await target.kick(
                        reason
                    );

                    const log =
                        new EmbedBuilder()

                            .setColor(
                                "#FFA500"
                            )

                            .setTitle(
                                "Member Kicked"
                            )

                            .addFields(

                                {
                                    name:
                                        "Target",
                                    value:
                                        target.user.tag
                                },

                                {
                                    name:
                                        "Moderator",
                                    value:
                                        interaction.user.tag
                                },

                                {
                                    name:
                                        "Reason",
                                    value:
                                        reason
                                }
                            )

                            .setTimestamp();

                    await sendLog(
                        interaction.guild,
                        LOG_CHANNELS.MOD,
                        log
                    );

                    return interaction.reply(
                        `✅ Kicked ${target.user.tag}`
                    );
                }

                // ================= MUTE =================

                if (cmd === "mute") {

                    if (
                        !interaction.member.permissions.has(
                            PermissionsBitField.Flags.ModerateMembers
                        )
                    ) {

                        return interaction.reply({
                            content:
                                "No Permission!",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const target =
                        interaction.options.getMember(
                            "user"
                        );

                    const minutes =
                        interaction.options.getInteger(
                            "minutes"
                        );

                    const reason =
                        interaction.options.getString(
                            "reason"
                        ) ||
                        "No reason";

                    if (!target) {

                        return interaction.reply({
                            content:
                                "❌ User not found.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    await target.timeout(
                        minutes * 60000,
                        reason
                    );

                    return interaction.reply(
                        `✅ ${target.user.tag} muted for ${minutes} minute(s).`
                    );
                }

                // ================= UNMUTE =================

                if (cmd === "unmute") {

                    if (
                        !interaction.member.permissions.has(
                            PermissionsBitField.Flags.ModerateMembers
                        )
                    ) {

                        return interaction.reply({
                            content:
                                "No Permission!",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const target =
                        interaction.options.getMember(
                            "user"
                        );

                    if (!target) {

                        return interaction.reply({
                            content:
                                "❌ User not found.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    await target.timeout(
                        null
                    );

                    return interaction.reply(
                        `✅ Timeout removed from ${target.user.tag}`
                    );
                }

                // ================= WARN =================

                if (cmd === "warn") {

                    if (
                        !interaction.member.permissions.has(
                            PermissionsBitField.Flags.ModerateMembers
                        )
                    ) {

                        return interaction.reply({
                            content:
                                "No Permission!",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const target =
                        interaction.options.getUser(
                            "user"
                        );

                    if (!warnings[target.id]) {

                        warnings[target.id] = 0;
                    }

                    warnings[target.id]++;

                    return interaction.reply(
                        `⚠️ ${target.tag} warned. Total warnings: ${warnings[target.id]}`
                    );
                }

                // ================= CLEAR =================

                if (cmd === "clear") {

                    if (
                        !interaction.member.permissions.has(
                            PermissionsBitField.Flags.ManageMessages
                        )
                    ) {

                        return interaction.reply({
                            content:
                                "No Permission!",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const amount =
                        interaction.options.getInteger(
                            "amount"
                        );

                    if (
                        amount < 1 ||
                        amount > 100
                    ) {

                        return interaction.reply({
                            content:
                                "Amount must be between 1 and 100.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    await interaction.channel.bulkDelete(
                        amount,
                        true
                    );

                    return interaction.reply({
                        content:
                            `✅ Deleted ${amount} messages.`,
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                // ================= MSG =================

                if (cmd === "msg") {

                    if (
                        !interaction.member.permissions.has(
                            PermissionsBitField.Flags.ManageMessages
                        )
                    ) {

                        return interaction.reply({
                            content:
                                "No Permission!",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        !LabelBuilder ||
                        !FileUploadBuilder ||
                        typeof ModalBuilder.prototype
                            .addLabelComponents !== "function"
                    ) {

                        return interaction.reply({
                            content:
                                "❌ New message form requires the latest discord.js. Run: npm install discord.js@latest",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const modal =
                        new ModalBuilder()

                            .setCustomId(
                                "modal_msg_builder"
                            )

                            .setTitle(
                                "SAM STUDIO Message Builder"
                            );

                    const channelInput =
                        new TextInputBuilder()

                            .setCustomId(
                                "msg_channel_id"
                            )

                            .setPlaceholder(
                                "Paste channel ID here"
                            )

                            .setStyle(
                                TextInputStyle.Short
                            )

                            .setMaxLength(
                                25
                            )

                            .setRequired(
                                true
                            );

                    const titleInput =
                        new TextInputBuilder()

                            .setCustomId(
                                "msg_title"
                            )

                            .setLabel(
                                "Title"
                            )

                            .setPlaceholder(
                                "Example: SAM Scale"
                            )

                            .setStyle(
                                TextInputStyle.Short
                            )

                            .setMaxLength(
                                200
                            )

                            .setRequired(
                                false
                            );

                    const contentInput =
                        new TextInputBuilder()

                            .setCustomId(
                                "msg_content"
                            )

                            .setLabel(
                                "Full Message"
                            )

                            .setPlaceholder(
                                "Write the complete product or announcement message here..."
                            )

                            .setStyle(
                                TextInputStyle.Paragraph
                            )

                            .setMaxLength(
                                3500
                            )

                            .setRequired(
                                false
                            );

                    const buttonsInput =
                        new TextInputBuilder()

                            .setCustomId(
                                "msg_buttons"
                            )

                            .setPlaceholder(
                                "Shop | https://link.com\nVideo | https://youtube.com/..."
                            )

                            .setStyle(
                                TextInputStyle.Paragraph
                            )

                            .setMaxLength(
                                3000
                            )

                            .setRequired(
                                false
                            );

                    const imageUpload =
                        new FileUploadBuilder()

                            .setCustomId(
                                "msg_image"
                            )

                            .setMinValues(
                                0
                            )

                            .setMaxValues(
                                1
                            )

                            .setRequired(
                                false
                            );

                    modal.addLabelComponents(

                        new LabelBuilder()
                            .setLabel("Destination Channel ID")
                            .setDescription("Only this field is required.")
                            .setTextInputComponent(channelInput),

                        new LabelBuilder()
                            .setLabel("Title (Optional)")
                            .setTextInputComponent(titleInput),

                        new LabelBuilder()
                            .setLabel("Full Message (Optional)")
                            .setTextInputComponent(contentInput),

                        new LabelBuilder()
                            .setLabel("Picture (Optional)")
                            .setDescription("Upload one PNG, JPG, GIF, or WEBP image.")
                            .setFileUploadComponent(imageUpload),

                        new LabelBuilder()
                            .setLabel("Custom Buttons (Optional)")
                            .setDescription("One per line: Button Name | https://link")
                            .setTextInputComponent(buttonsInput)
                    );

                    return interaction.showModal(
                        modal
                    );
                }

                // ================= SERVER INFO =================

                if (cmd === "serverinfo") {

                    const guild =
                        interaction.guild;

                    const embed =
                        new EmbedBuilder()

                            .setColor(
                                0x2b2d31
                            )

                            .setTitle(
                                `${guild.name} Server Information`
                            )

                            .addFields(

                                {
                                    name:
                                        "Server Name",
                                    value:
                                        guild.name,
                                    inline:
                                        true
                                },

                                {
                                    name:
                                        "Members",
                                    value:
                                        `${guild.memberCount}`,
                                    inline:
                                        true
                                },

                                {
                                    name:
                                        "Server ID",
                                    value:
                                        guild.id,
                                    inline:
                                        false
                                },

                                {
                                    name:
                                        "Created",
                                    value:
                                        `<t:${Math.floor(
                                            guild.createdTimestamp /
                                            1000
                                        )}:F>`,
                                    inline:
                                        false
                                }
                            )

                            .setThumbnail(
                                guild.iconURL({
                                    dynamic: true
                                })
                            );

                    return interaction.reply({
                        embeds: [
                            embed
                        ]
                    });
                }

                // ================= MEMBER INFO =================

                if (cmd === "memberinfo") {

                    const target =
                        interaction.options.getMember(
                            "user"
                        ) ||
                        interaction.member;

                    const embed =
                        new EmbedBuilder()

                            .setColor(
                                0x2b2d31
                            )

                            .setTitle(
                                `Member Info - ${target.user.tag}`
                            )

                            .setThumbnail(
                                target.user.displayAvatarURL({
                                    dynamic: true
                                })
                            )

                            .addFields(

                                {
                                    name:
                                        "User ID",
                                    value:
                                        target.id
                                },

                                {
                                    name:
                                        "Joined Server",
                                    value:
                                        target.joinedTimestamp
                                            ? `<t:${Math.floor(
                                                target.joinedTimestamp /
                                                1000
                                            )}:F>`
                                            : "Unknown"
                                },

                                {
                                    name:
                                        "Account Created",
                                    value:
                                        `<t:${Math.floor(
                                            target.user.createdTimestamp /
                                            1000
                                        )}:F>`
                                }
                            );

                    return interaction.reply({
                        embeds: [
                            embed
                        ]
                    });
                }

                // ================= GIVE ROLE =================

                if (cmd === "giverole") {

                    if (
                        !interaction.member.permissions.has(
                            PermissionsBitField.Flags.ManageRoles
                        )
                    ) {

                        return interaction.reply({
                            content:
                                "No Permission!",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const roleId =
                        interaction.options.getString(
                            "roleid"
                        );

                    const targetValue =
                        interaction.options.getString(
                            "target"
                        );

                    const role =
                        interaction.guild.roles.cache.get(
                            roleId
                        );

                    if (!role) {

                        return interaction.reply({
                            content:
                                "❌ Invalid Role ID.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    await interaction.deferReply({
                        flags:
                            MessageFlags.Ephemeral
                    });

                    if (
                        targetValue.toLowerCase() ===
                        "all"
                    ) {

                        const members =
                            await interaction.guild.members.fetch();

                        for (
                            const [, member]
                            of members
                        ) {

                            if (
                                member.user.bot
                            ) continue;

                            await member.roles
                                .add(role)
                                .catch(() => {});
                        }

                        return interaction.editReply(
                            `✅ Role ${role.name} given to all members.`
                        );
                    }

                    const userId =
                        targetValue.replace(
                            /[<@!>]/g,
                            ""
                        );

                    const member =
                        await interaction.guild.members
                            .fetch(userId)
                            .catch(() => null);

                    if (!member) {

                        return interaction.editReply(
                            "❌ User not found."
                        );
                    }

                    await member.roles.add(
                        role
                    );

                    return interaction.editReply(
                        `✅ ${role.name} given to ${member.user.tag}.`
                    );
                }

                // ================= REMOVE ROLE =================

                if (cmd === "removerole") {

                    if (
                        !interaction.member.permissions.has(
                            PermissionsBitField.Flags.ManageRoles
                        )
                    ) {

                        return interaction.reply({
                            content:
                                "No Permission!",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const roleId =
                        interaction.options.getString(
                            "roleid"
                        );

                    const targetValue =
                        interaction.options.getString(
                            "target"
                        );

                    const role =
                        interaction.guild.roles.cache.get(
                            roleId
                        );

                    if (!role) {

                        return interaction.reply({
                            content:
                                "❌ Invalid Role ID.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    await interaction.deferReply({
                        flags:
                            MessageFlags.Ephemeral
                    });

                    if (
                        targetValue.toLowerCase() ===
                        "all"
                    ) {

                        const members =
                            await interaction.guild.members.fetch();

                        for (
                            const [, member]
                            of members
                        ) {

                            if (
                                member.user.bot
                            ) continue;

                            await member.roles
                                .remove(role)
                                .catch(() => {});
                        }

                        return interaction.editReply(
                            `✅ Role ${role.name} removed from all members.`
                        );
                    }

                    const userId =
                        targetValue.replace(
                            /[<@!>]/g,
                            ""
                        );

                    const member =
                        await interaction.guild.members
                            .fetch(userId)
                            .catch(() => null);

                    if (!member) {

                        return interaction.editReply(
                            "❌ User not found."
                        );
                    }

                    await member.roles.remove(
                        role
                    );

                    return interaction.editReply(
                        `✅ ${role.name} removed from ${member.user.tag}.`
                    );
                }
            }

            // =================================================
            // MODAL SUBMIT
            // =================================================

            if (
                interaction.isModalSubmit()
            ) {

                // ================= MSG MODAL =================

                if (
                    interaction.customId ===
                    "modal_msg_builder"
                ) {

                    if (
                        !interaction.member.permissions.has(
                            PermissionsBitField.Flags.ManageMessages
                        )
                    ) {

                        return interaction.reply({
                            content:
                                "No Permission!",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const rawChannelId =
                        interaction.fields.getTextInputValue(
                            "msg_channel_id"
                        );

                    const channelId =
                        rawChannelId.replace(
                            /[<#>\s]/g,
                            ""
                        );

                    const title =
                        interaction.fields.getTextInputValue(
                            "msg_title"
                        ).trim();

                    const content =
                        interaction.fields.getTextInputValue(
                            "msg_content"
                        ).trim();

                    const rawButtons =
                        interaction.fields.getTextInputValue(
                            "msg_buttons"
                        ).trim();

                    let buttonData;

                    try {
                        buttonData =
                            parseMessageButtons(
                                rawButtons
                            );
                    } catch (error) {

                        return interaction.reply({
                            content:
                                `❌ ${error.message}`,
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    let image = null;

                    try {
                        const uploadedFiles =
                            interaction.fields.getUploadedFiles(
                                "msg_image"
                            );

                        image =
                            uploadedFiles?.first?.() ||
                            null;

                    } catch (error) {

                        return interaction.reply({
                            content:
                                "❌ Image form requires the latest discord.js. Run: npm install discord.js@latest",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        image &&
                        !image.contentType?.startsWith("image/") &&
                        !/\.(png|jpe?g|gif|webp)$/i.test(image.name || "")
                    ) {

                        return interaction.reply({
                            content:
                                "❌ Please upload a PNG, JPG, GIF, or WEBP image.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    await interaction.deferReply({
                        flags:
                            MessageFlags.Ephemeral
                    });

                    const channel =
                        interaction.guild.channels.cache.get(
                            channelId
                        ) ||
                        await interaction.guild.channels
                            .fetch(channelId)
                            .catch(() => null);

                    if (
                        !channel ||
                        !channel.isTextBased() ||
                        typeof channel.send !== "function"
                    ) {

                        return interaction.editReply(
                            "❌ Channel was not found or I cannot send messages there."
                        );
                    }

                    if (
                        !ContainerBuilder ||
                        !TextDisplayBuilder ||
                        !MediaGalleryBuilder ||
                        !SeparatorBuilder ||
                        !SeparatorSpacingSize ||
                        MessageFlags.IsComponentsV2 === undefined
                    ) {

                        return interaction.editReply(
                            "❌ Full clean layout requires the latest discord.js. Run: npm install discord.js@latest"
                        );
                    }

                    const linkButtons =
                        buttonData.map(button =>
                            new ButtonBuilder()
                                .setLabel(button.label)
                                .setStyle(ButtonStyle.Link)
                                .setURL(button.url)
                        );

                    const displayParts = [];

                    if (title) {
                        displayParts.push(
                            `## ⚡ ${title}`
                        );
                    }

                    if (content) {
                        displayParts.push(
                            content
                        );
                    }

                    if (displayParts.length === 0) {
                        displayParts.push(
                            "## ⚡ SAM STUDIO"
                        );
                    }

                    const container =
                        new ContainerBuilder()

                            .setAccentColor(
                                0x8B0000
                            )

                            .addTextDisplayComponents(
                                new TextDisplayBuilder()
                                    .setContent(
                                        displayParts.join(
                                            "\n\n"
                                        )
                                    )
                            );

                    let attachmentName = null;

                    if (image) {

                        const extensionMatch =
                            (image.name || "")
                                .match(/\.(png|jpe?g|gif|webp)$/i);

                        const mimeExtensions = {
                            "image/png": "png",
                            "image/jpeg": "jpg",
                            "image/gif": "gif",
                            "image/webp": "webp"
                        };

                        const extension =
                            extensionMatch?.[1]
                                ?.toLowerCase()
                                ?.replace("jpeg", "jpg") ||
                            mimeExtensions[image.contentType] ||
                            "png";

                        attachmentName =
                            `sam-message-${interaction.id}.${extension}`;

                        container

                            .addSeparatorComponents(
                                new SeparatorBuilder()
                                    .setDivider(true)
                                    .setSpacing(
                                        SeparatorSpacingSize.Small
                                    )
                            )

                            .addMediaGalleryComponents(
                                new MediaGalleryBuilder()
                                    .addItems(item =>
                                        item
                                            .setURL(
                                                `attachment://${attachmentName}`
                                            )
                                            .setDescription(
                                                `${title || "SAM STUDIO"} image`
                                            )
                                    )
                            )

                            .addSeparatorComponents(
                                new SeparatorBuilder()
                                    .setDivider(true)
                                    .setSpacing(
                                        SeparatorSpacingSize.Small
                                    )
                            );
                    }

                    if (linkButtons.length > 0) {

                        if (!image) {
                            container.addSeparatorComponents(
                                new SeparatorBuilder()
                                    .setDivider(true)
                                    .setSpacing(
                                        SeparatorSpacingSize.Small
                                    )
                            );
                        }

                        container.addActionRowComponents(
                            new ActionRowBuilder()
                                .addComponents(
                                    linkButtons
                                )
                        );
                    }

                    const payload = {
                        components: [
                            container
                        ],
                        flags:
                            MessageFlags.IsComponentsV2
                    };

                    if (
                        image &&
                        attachmentName
                    ) {
                        payload.files = [
                            {
                                attachment:
                                    image.url,
                                name:
                                    attachmentName
                            }
                        ];
                    }

                    let sentMessage;

                    try {
                        sentMessage =
                            await channel.send(
                                payload
                            );
                    } catch (error) {

                        console.error(
                            "Unable to send /msg message:",
                            error
                        );

                        return interaction.editReply(
                            "❌ Message could not be sent. Check my channel permissions and the supplied links/image."
                        );
                    }

                    for (const emoji of ["❤️", "🔥", "😊"]) {
                        await sentMessage.react(emoji).catch(() => {});
                    }

                    return interaction.editReply(
                        `✅ Clean message sent in ${channel}!`
                    );
                }

                // ================= TICKET MODAL =================

                await interaction.deferReply({
                    flags:
                        MessageFlags.Ephemeral
                });

                const type =
                    interaction.customId.replace(
                        "modal_",
                        ""
                    );

                if (
                    await hasOpenTicket(
                        interaction.guild,
                        interaction.user.id,
                        type
                    )
                ) {

                    return interaction.editReply({
                        content:
                            "❌ You already have an open ticket for this category!"
                    });
                }

                const ticketCategory =
                    await getTicketCategory(
                        interaction.guild,
                        type
                    );

                // Clean username for channel
                const cleanUsername =
                    interaction.user.username
                        .toLowerCase()
                        .replace(
                            /[^a-z0-9-_]/g,
                            "-"
                        )
                        .slice(
                            0,
                            40
                        );

                const ticketChannel =
                    await interaction.guild.channels.create({

                        name:
                            `${EMOJIS[type] || "🎫"}-${cleanUsername}`,

                        type:
                            ChannelType.GuildText,

                        parent:
                            ticketCategory.id,

                        topic:
                            `sam-ticket-type:${type}|sam-ticket-user:${interaction.user.id}`,

                        permissionOverwrites: [

                            {
                                id:
                                    interaction.guild.id,

                                deny: [
                                    PermissionsBitField.Flags.ViewChannel
                                ]
                            },

                            {
                                id:
                                    interaction.user.id,

                                allow: [
                                    PermissionsBitField.Flags.ViewChannel,
                                    PermissionsBitField.Flags.SendMessages,
                                    PermissionsBitField.Flags.ReadMessageHistory
                                ]
                            },

                            {
                                id:
                                    STAFF_ROLE_ID,

                                allow: [
                                    PermissionsBitField.Flags.ViewChannel,
                                    PermissionsBitField.Flags.SendMessages,
                                    PermissionsBitField.Flags.ReadMessageHistory,
                                    PermissionsBitField.Flags.AttachFiles,
                                    PermissionsBitField.Flags.EmbedLinks
                                ]
                            }
                        ]
                    });

                // ================= BUILD FORM FIELDS =================

                const fields = [];

                interaction.fields.fields.forEach(
                    f => {

                        fields.push({

                            name:
                                f.customId
                                    .toUpperCase()
                                    .replace(
                                        /_/g,
                                        " "
                                    ),

                            value:
                                `\`\`\`${f.value || "N/A"}\`\`\``
                        });
                    }
                );

                // ================= TICKET EMBED =================

                const embed =
                    new EmbedBuilder()

                        .setColor(
                            0x2b2d31
                        )

                        .setTitle(
                            `${EMOJIS[type] || "🎫"} ${TICKET_LABELS[type] || "Support"} Ticket`
                        )

                        .setDescription(
                            `Thank you for contacting **SAM STUDIO**.\nOur staff team will assist you shortly.`
                        )

                        .addFields(
                            fields
                        )

                        .setFooter({
                            text:
                                `Opened by ${interaction.user.tag} • SAM STUDIO`
                        })

                        .setTimestamp();

                // ================= BUTTONS =================

                const row =
                    new ActionRowBuilder()
                        .addComponents(

                            new ButtonBuilder()
                                .setCustomId(
                                    "claim"
                                )
                                .setLabel(
                                    "Claim"
                                )
                                .setEmoji(
                                    "🙋"
                                )
                                .setStyle(
                                    ButtonStyle.Primary
                                ),

                            new ButtonBuilder()
                                .setCustomId(
                                    "close"
                                )
                                .setLabel(
                                    "Close"
                                )
                                .setEmoji(
                                    "🔒"
                                )
                                .setStyle(
                                    ButtonStyle.Danger
                                )
                        );

                await ticketChannel.send({

                    content:
                        `<@${interaction.user.id}> <@&${STAFF_ROLE_ID}>\n\n**Your Ticket Is Opened, The SAM STUDIO Staff Team Will Assist You As Soon as Possible. Till Then Please Wait! <3**`,

                    embeds: [
                        embed
                    ],

                    components: [
                        row
                    ]
                });

                // ================= LOG =================

                const log =
                    new EmbedBuilder()

                        .setColor(
                            "#3498DB"
                        )

                        .setTitle(
                            "Ticket Created"
                        )

                        .addFields(

                            {
                                name:
                                    "User",
                                value:
                                    interaction.user.tag
                            },

                            {
                                name:
                                    "Channel",
                                value:
                                    `<#${ticketChannel.id}>`
                            },

                            {
                                name:
                                    "Type",
                                value:
                                    TICKET_LABELS[type] ||
                                    type.toUpperCase()
                            }
                        )

                        .setTimestamp();

                await sendLog(
                    interaction.guild,
                    LOG_CHANNELS.TICKET,
                    log
                );

                return interaction.editReply(
                    `✅ Ticket Created: ${ticketChannel}`
                );
            }

            // =================================================
            // TICKET SELECT MENU
            // =================================================

            if (
                interaction.isStringSelectMenu() &&
                interaction.customId ===
                "ticket_select"
            ) {

                const type =
                    interaction.values[0];

                const label =
                    TICKET_LABELS[type] ||
                    "Support";

                const modal =
                    new ModalBuilder()

                        .setCustomId(
                            `modal_${type}`
                        )

                        .setTitle(
                            `${EMOJIS[type] || "🎫"} ${label} Form`
                        );

                // =================================================
                // PRE-PURCHASE QUESTIONS
                // =================================================

                if (type === "pre_purchase") {

                    modal.addComponents(

                        new ActionRowBuilder()
                            .addComponents(

                                new TextInputBuilder()

                                    .setCustomId(
                                        "help"
                                    )

                                    .setLabel(
                                        "What would you like to know?"
                                    )

                                    .setPlaceholder(
                                        "Enter your questions before purchasing..."
                                    )

                                    .setStyle(
                                        TextInputStyle.Paragraph
                                    )

                                    .setRequired(
                                        true
                                    )
                            )
                    );
                }

                // =================================================
                // SCRIPT SUPPORT
                // =================================================

                else if (
                    type === "script_support"
                ) {

                    modal.addComponents(

                        new ActionRowBuilder()
                            .addComponents(

                                new TextInputBuilder()

                                    .setCustomId(
                                        "script_issue"
                                    )

                                    .setLabel(
                                        "How can we help with the script?"
                                    )

                                    .setPlaceholder(
                                        "Explain the script issue in detail..."
                                    )

                                    .setStyle(
                                        TextInputStyle.Paragraph
                                    )

                                    .setRequired(
                                        true
                                    )
                            )
                    );
                }

                // =================================================
                // PARTNERS
                // =================================================

                else if (
                    type === "partners"
                ) {

                    modal.addComponents(

                        new ActionRowBuilder()
                            .addComponents(

                                new TextInputBuilder()

                                    .setCustomId(
                                        "partnership_details"
                                    )

                                    .setLabel(
                                        "Tell us about your partnership"
                                    )

                                    .setPlaceholder(
                                        "Share your community, project, and partnership details..."
                                    )

                                    .setStyle(
                                        TextInputStyle.Paragraph
                                    )

                                    .setRequired(
                                        true
                                    )
                            )
                    );
                }

                else {
                    return interaction.reply({
                        content:
                            "❌ Invalid ticket category.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                return interaction.showModal(
                    modal
                );
            }

            // =================================================
            // BUTTON HANDLER
            // =================================================

            if (
                interaction.isButton()
            ) {

                // =================================================
                // CLAIM
                // =================================================

                if (
                    interaction.customId ===
                    "claim"
                ) {

                    if (
                        !isStaffMember(
                            interaction.member
                        )
                    ) {

                        return interaction.reply({
                            content:
                                "Staff Only!",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    await interaction.deferReply({
                        flags:
                            MessageFlags.Ephemeral
                    });

                    const log =
                        new EmbedBuilder()

                            .setColor(
                                "#2ECC71"
                            )

                            .setTitle(
                                "Ticket Claimed"
                            )

                            .addFields(

                                {
                                    name:
                                        "Channel",
                                    value:
                                        interaction.channel.name
                                },

                                {
                                    name:
                                        "Staff Member",
                                    value:
                                        interaction.user.tag
                                }
                            )

                            .setTimestamp();

                    await sendLog(
                        interaction.guild,
                        LOG_CHANNELS.TICKET,
                        log
                    );

                    return interaction.editReply(
                        `✅ Ticket claimed by <@${interaction.user.id}>`
                    );
                }

                // =================================================
                // CLOSE
                // =================================================

                if (
                    interaction.customId ===
                    "close"
                ) {

                    if (
                        !isStaffMember(
                            interaction.member
                        )
                    ) {

                        return interaction.reply({
                            content:
                                "Staff Only!",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    await interaction.deferReply({
                        flags:
                            MessageFlags.Ephemeral
                    });

                    const creator =
                        await getTicketCreator(
                            interaction.channel
                        );

                    // ================= TRANSCRIPT =================

                    if (creator) {

                        try {

                            const messages =
                                await interaction.channel.messages.fetch({
                                    limit:
                                        100
                                });

                            let transcript =
                                `SAM STUDIO Ticket Transcript\n` +
                                `Ticket: ${interaction.channel.name}\n` +
                                `Generated: ${new Date().toLocaleString()}\n\n`;

                            messages
                                .reverse()
                                .forEach(
                                    m => {

                                        transcript +=
                                            `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content}\n`;
                                    }
                                );

                            const buffer =
                                Buffer.from(
                                    transcript,
                                    "utf-8"
                                );

                            await creator.send({

                                content:
                                    `📄 **Your SAM STUDIO Ticket Transcript** - ${interaction.channel.name}`,

                                files: [
                                    {
                                        attachment:
                                            buffer,

                                        name:
                                            `transcript-${interaction.channel.name}.txt`
                                    }
                                ]
                            });

                        } catch (e) {

                            console.log(
                                "Unable to DM transcript."
                            );
                        }
                    }

                    // Move to closed category

                    await interaction.channel
                        .setParent(
                            CLOSED_CATEGORY_ID
                        )
                        .catch(() => {});

                    // Prevent double closed-
                    if (
                        !interaction.channel.name.startsWith(
                            "closed-"
                        )
                    ) {

                        await interaction.channel.setName(
                            `closed-${interaction.channel.name}`
                        );
                    }

                    // ================= CLOSE LOG =================

                    const log =
                        new EmbedBuilder()

                            .setColor(
                                "#E74C3C"
                            )

                            .setTitle(
                                "Ticket Closed"
                            )

                            .addFields(

                                {
                                    name:
                                        "Channel",
                                    value:
                                        interaction.channel.name
                                },

                                {
                                    name:
                                        "Closed By",
                                    value:
                                        interaction.user.tag
                                }
                            )

                            .setTimestamp();

                    await sendLog(
                        interaction.guild,
                        LOG_CHANNELS.TICKET,
                        log
                    );

                    // ================= REOPEN / DELETE =================

                    const reopenRow =
                        new ActionRowBuilder()
                            .addComponents(

                                new ButtonBuilder()
                                    .setCustomId(
                                        "reopen"
                                    )
                                    .setLabel(
                                        "Reopen"
                                    )
                                    .setEmoji(
                                        "🔓"
                                    )
                                    .setStyle(
                                        ButtonStyle.Success
                                    ),

                                new ButtonBuilder()
                                    .setCustomId(
                                        "delete"
                                    )
                                    .setLabel(
                                        "Delete"
                                    )
                                    .setEmoji(
                                        "🗑️"
                                    )
                                    .setStyle(
                                        ButtonStyle.Danger
                                    )
                            );

                    return interaction.editReply({

                        content:
                            "Ticket Closed. ✅ Transcript sent to opener's DM.",

                        components: [
                            reopenRow
                        ]
                    });
                }

                // =================================================
                // REOPEN
                // =================================================

                if (
                    interaction.customId ===
                    "reopen"
                ) {

                    if (
                        !isStaffMember(
                            interaction.member
                        )
                    ) {

                        return interaction.reply({
                            content:
                                "Staff Only!",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    await interaction.deferReply({
                        flags:
                            MessageFlags.Ephemeral
                    });

                    const originalName =
                        interaction.channel.name.replace(
                            "closed-",
                            ""
                        );

                    // Find original ticket type from channel topic

                    const typeMatch =
                        interaction.channel.topic?.match(
                            /sam-ticket-type:([^|]+)/
                        );

                    const originalType =
                        typeMatch?.[1] ||
                        "script_support";

                    const originalCategory =
                        await getTicketCategory(
                            interaction.guild,
                            originalType
                        );

                    await interaction.channel.setName(
                        originalName
                    );

                    // Restore to EXACT original category

                    await interaction.channel
                        .setParent(
                            originalCategory.id
                        )
                        .catch(() => {});

                    const log =
                        new EmbedBuilder()

                            .setColor(
                                "#2ECC71"
                            )

                            .setTitle(
                                "Ticket Reopened"
                            )

                            .addFields(

                                {
                                    name:
                                        "Channel",
                                    value:
                                        interaction.channel.name
                                },

                                {
                                    name:
                                        "Reopened By",
                                    value:
                                        interaction.user.tag
                                },

                                {
                                    name:
                                        "Ticket Type",
                                    value:
                                        TICKET_LABELS[
                                            originalType
                                        ] ||
                                        originalType
                                }
                            )

                            .setTimestamp();

                    await sendLog(
                        interaction.guild,
                        LOG_CHANNELS.TICKET,
                        log
                    );

                    return interaction.editReply(
                        "✅ Ticket Reopened!"
                    );
                }

                // =================================================
                // DELETE
                // =================================================

                if (
                    interaction.customId ===
                    "delete"
                ) {

                    if (
                        !isStaffMember(
                            interaction.member
                        )
                    ) {

                        return interaction.reply({
                            content:
                                "Staff Only!",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    await interaction.deferReply({
                        flags:
                            MessageFlags.Ephemeral
                    });

                    // ================= TRANSCRIPT =================

                    const messages =
                        await interaction.channel.messages.fetch({
                            limit:
                                100
                        });

                    let transcript =
                        `SAM STUDIO Ticket Transcript\n` +
                        `Ticket: ${interaction.channel.name}\n` +
                        `Generated: ${new Date().toLocaleString()}\n\n`;

                    messages
                        .reverse()
                        .forEach(
                            m => {

                                transcript +=
                                    `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content}\n`;
                            }
                        );

                    const buffer =
                        Buffer.from(
                            transcript,
                            "utf-8"
                        );

                    // ================= DELETE LOG =================

                    const log =
                        new EmbedBuilder()

                            .setColor(
                                "#000000"
                            )

                            .setTitle(
                                "Ticket Deleted"
                            )

                            .addFields(

                                {
                                    name:
                                        "Channel",
                                    value:
                                        interaction.channel.name
                                },

                                {
                                    name:
                                        "Deleted By",
                                    value:
                                        interaction.user.tag
                                }
                            )

                            .setTimestamp();

                    const ticketLogChan =
                        interaction.guild.channels.cache.get(
                            LOG_CHANNELS.TICKET
                        );

                    if (ticketLogChan) {

                        await ticketLogChan.send({

                            embeds: [
                                log
                            ],

                            files: [
                                {
                                    attachment:
                                        buffer,

                                    name:
                                        `transcript-${interaction.channel.id}.txt`
                                }
                            ]
                        });
                    }

                    return interaction.channel.delete();
                }
            }

        } catch (err) {

            console.error(err);

            if (
                interaction.isRepliable() &&
                !interaction.replied &&
                !interaction.deferred
            ) {

                interaction.reply({
                    content:
                        "❌ Something went wrong!",
                    flags:
                        MessageFlags.Ephemeral
                }).catch(() => {});
            }
        }
    }
);

// =====================================================
// ANTI-PING + SPAM PROTECTION
// =====================================================

client.on(
    Events.MessageCreate,
    async (message) => {

        if (
            message.author.bot
        ) return;

        // ================= AUTO MESSAGE =================

        if (
            message.content.toLowerCase() ===
            "!automsg"
        ) {

            const autoEmbed =
                new EmbedBuilder()

                    .setTitle(
                        "Welcome to SAM STUDIO"
                    )

                    .setDescription(
                        "Enjoy your stay! Follow the rules and have fun."
                    )

                    .setColor(
                        0x2b2d31
                    );

            return message.channel.send({
                embeds: [
                    autoEmbed
                ]
            });
        }

        let shouldBlock =
            false;

        // Check member mentions

        message.mentions.members.forEach(
            member => {

                if (
                    ANTI_PING_MEMBERS.has(
                        member.id
                    )
                ) {

                    shouldBlock =
                        true;
                }
            }
        );

        // Check protected role

        if (
            message.mentions.roles.has(
                ANTI_PING_ROLE_ID
            )
        ) {

            shouldBlock =
                true;
        }

        if (shouldBlock) {

            const userId =
                message.author.id;

            const now =
                Date.now();

            if (
                !antiPingAttempts.has(
                    userId
                )
            ) {

                antiPingAttempts.set(
                    userId,
                    {
                        count:
                            0,

                        timestamp:
                            now
                    }
                );
            }

            const data =
                antiPingAttempts.get(
                    userId
                );

            if (
                now -
                data.timestamp >
                60000
            ) {

                data.count =
                    0;

                data.timestamp =
                    now;
            }

            data.count +=
                1;

            await message.delete()
                .catch(() => {});

            // 3rd attempt = timeout

            if (
                data.count >= 3
            ) {

                try {

                    await message.member.timeout(
                        10 * 60000,
                        "Anti-Ping Spam"
                    );

                    const log =
                        new EmbedBuilder()

                            .setColor(
                                "#FF0000"
                            )

                            .setTitle(
                                "Anti-Ping Timeout"
                            )

                            .addFields(

                                {
                                    name:
                                        "User",
                                    value:
                                        message.author.tag
                                },

                                {
                                    name:
                                        "Reason",
                                    value:
                                        "Protected member ping spam"
                                }
                            )

                            .setTimestamp();

                    await sendLog(
                        message.guild,
                        LOG_CHANNELS.MOD,
                        log
                    );

                } catch (e) {}

                antiPingAttempts.delete(
                    userId
                );

            } else {

                const remaining =
                    3 -
                    data.count;

                await message.channel.send({

                    content:
                        `${message.author}`,

                    embeds: [

                        new EmbedBuilder()

                            .setColor(
                                "#FFA500"
                            )

                            .setDescription(
                                `🚫 Protected staff ko ping mat karo!\n${remaining} try baaki. 3rd try par 10 min timeout.`
                            )
                    ]

                }).then(
                    msg =>
                        setTimeout(
                            () =>
                                msg.delete()
                                    .catch(
                                        () => {}
                                    ),
                            8000
                        )
                );
            }

            return;
        }
    }
);

// =====================================================
// MESSAGE DELETE LOG
// =====================================================

client.on(
    Events.MessageDelete,
    async (message) => {

        if (
            message.author?.bot ||
            !LOG_CHANNELS.MSG
        ) return;

        const embed =
            new EmbedBuilder()

                .setColor(
                    "#FF0000"
                )

                .setTitle(
                    "Message Deleted"
                )

                .addFields(

                    {
                        name:
                            "Author",
                        value:
                            `${message.author.tag}`
                    },

                    {
                        name:
                            "Channel",
                        value:
                            `<#${message.channel.id}>`
                    },

                    {
                        name:
                            "Content",
                        value:
                            message.content?.slice(
                                0,
                                1000
                            ) ||
                            "No Content"
                    }
                )

                .setTimestamp();

        await sendLog(
            message.guild,
            LOG_CHANNELS.MSG,
            embed
        );
    }
);

// =====================================================
// MESSAGE UPDATE LOG
// =====================================================

client.on(
    Events.MessageUpdate,
    async (
        oldMessage,
        newMessage
    ) => {

        if (
            oldMessage.author?.bot ||
            !LOG_CHANNELS.MSG
        ) return;

        if (
            oldMessage.content ===
            newMessage.content
        ) return;

        const embed =
            new EmbedBuilder()

                .setColor(
                    "#FFA500"
                )

                .setTitle(
                    "Message Edited"
                )

                .addFields(

                    {
                        name:
                            "Author",
                        value:
                            `${oldMessage.author.tag}`
                    },

                    {
                        name:
                            "Channel",
                        value:
                            `<#${oldMessage.channel.id}>`
                    },

                    {
                        name:
                            "Before",
                        value:
                            oldMessage.content?.slice(
                                0,
                                500
                            ) ||
                            "No Content"
                    },

                    {
                        name:
                            "After",
                        value:
                            newMessage.content?.slice(
                                0,
                                500
                            ) ||
                            "No Content"
                    }
                )

                .setTimestamp();

        await sendLog(
            oldMessage.guild,
            LOG_CHANNELS.MSG,
            embed
        );
    }
);

// =====================================================
// VOICE CHANNEL LOG
// =====================================================

client.on(
    Events.VoiceStateUpdate,
    async (
        oldState,
        newState
    ) => {

        if (
            !LOG_CHANNELS.VC
        ) return;

        const member =
            newState.member;

        if (
            oldState.channelId !==
            newState.channelId
        ) {

            let action =
                "";

            if (
                !oldState.channelId
            ) {

                action =
                    "Joined VC";

            } else if (
                !newState.channelId
            ) {

                action =
                    "Left VC";

            } else {

                action =
                    "Switched VC";
            }

            const embed =
                new EmbedBuilder()

                    .setColor(
                        "#00FFFF"
                    )

                    .setTitle(
                        "Voice Channel Update"
                    )

                    .addFields(

                        {
                            name:
                                "Member",
                            value:
                                member.user.tag
                        },

                        {
                            name:
                                "Action",
                            value:
                                action
                        }
                    )

                    .setTimestamp();

            await sendLog(
                newState.guild,
                LOG_CHANNELS.VC,
                embed
            );
        }
    }
);

// =====================================================
// MEMBER UPDATE
// ROLE + NICKNAME LOGS
// =====================================================

client.on(
    Events.GuildMemberUpdate,
    async (
        oldMember,
        newMember
    ) => {

        // ================= ROLE LOGS =================

        if (
            LOG_CHANNELS.ROLE
        ) {

            const oldRoles =
                oldMember.roles.cache;

            const newRoles =
                newMember.roles.cache;

            const added =
                newRoles.filter(
                    r =>
                        !oldRoles.has(
                            r.id
                        )
                );

            const removed =
                oldRoles.filter(
                    r =>
                        !newRoles.has(
                            r.id
                        )
                );

            if (
                added.size ||
                removed.size
            ) {

                const embed =
                    new EmbedBuilder()

                        .setColor(
                            "#9B59B6"
                        )

                        .setTitle(
                            "Role Updated"
                        )

                        .addFields(

                            {
                                name:
                                    "Member",
                                value:
                                    newMember.user.tag
                            },

                            {
                                name:
                                    "Added",
                                value:
                                    added.size
                                        ? added
                                            .map(
                                                r =>
                                                    r.name
                                            )
                                            .join(
                                                ", "
                                            )
                                        : "None"
                            },

                            {
                                name:
                                    "Removed",
                                value:
                                    removed.size
                                        ? removed
                                            .map(
                                                r =>
                                                    r.name
                                            )
                                            .join(
                                                ", "
                                            )
                                        : "None"
                            }
                        )

                        .setTimestamp();

                await sendLog(
                    newMember.guild,
                    LOG_CHANNELS.ROLE,
                    embed
                );
            }
        }

        // ================= NICKNAME LOGS =================

        if (
            LOG_CHANNELS.NICKNAME &&
            oldMember.nickname !==
            newMember.nickname
        ) {

            const embed =
                new EmbedBuilder()

                    .setColor(
                        "#F1C40F"
                    )

                    .setTitle(
                        "Nickname Changed"
                    )

                    .addFields(

                        {
                            name:
                                "Member",
                            value:
                                newMember.user.tag
                        },

                        {
                            name:
                                "Old",
                            value:
                                oldMember.nickname ||
                                "None"
                        },

                        {
                            name:
                                "New",
                            value:
                                newMember.nickname ||
                                "None"
                        }
                    )

                    .setTimestamp();

            await sendLog(
                newMember.guild,
                LOG_CHANNELS.NICKNAME,
                embed
            );
        }
    }
);

// =====================================================
// MEMBER JOIN
// =====================================================

client.on(
    Events.GuildMemberAdd,
    async (member) => {

        console.log(
            `[DEBUG] New member joined: ${member.user.tag} (${member.id})`
        );

        // ================= VERIFIED ROLE =================

        if (
            VERIFIED_ROLE_ID
        ) {

            await member.roles
                .add(
                    VERIFIED_ROLE_ID
                )
                .catch(
                    () => {}
                );
        }

        // ================= WELCOME =================

        if (
            WELCOME_CHANNEL_ID
        ) {

            const channel =
                member.guild.channels.cache.get(
                    WELCOME_CHANNEL_ID
                );

            if (channel) {

                const embed =
                    new EmbedBuilder()

                        .setTitle(
                            "Welcome to SAM STUDIO | 2026!"
                        )

                        .setColor(
                            0x8B00FF
                        )

                        .setDescription(
                            `Hey ${member}, glad you found us!\nWe are happy to welcome you to SAM STUDIO.`
                        )

                        .setThumbnail(
                            member.user.displayAvatarURL({
                                dynamic:
                                    true
                            })
                        )

                        .setImage(
                            "https://cdn.discordapp.com/attachments/1525436919557914655/1525446030529794089/ChatGPT_Image_Jul_11_2026_03_17_45_PM.png?ex=6a5369d3&is=6a521853&hm=6c54f6174190b7ed868ff6c83a27a5a56c978c1e92fcc271242e2e2118bc909d&"
                        )

                        .setFooter({
                            text:
                                "SAM STUDIO | 2026"
                        })

                        .setTimestamp();

                channel.send({
                    embeds: [
                        embed
                    ]
                }).catch(
                    () => {}
                );
            }
        }

        // ================= INVITE TRACKER =================

        if (
            LOG_CHANNELS.INVITE
        ) {

            try {

                const guildInvites =
                    await member.guild.invites.fetch();

                let usedInvite =
                    null;

                let inviter =
                    null;

                guildInvites.forEach(
                    invite => {

                        const oldUses =
                            invites.get(
                                invite.code
                            ) || 0;

                        if (
                            invite.uses >
                            oldUses
                        ) {

                            usedInvite =
                                invite;

                            inviter =
                                invite.inviter;
                        }
                    }
                );

                if (usedInvite) {

                    invites.set(
                        usedInvite.code,
                        usedInvite.uses
                    );

                    const logEmbed =
                        new EmbedBuilder()

                            .setTitle(
                                "📨 New Member via Invite"
                            )

                            .setColor(
                                "#00FF00"
                            )

                            .addFields(

                                {
                                    name:
                                        "Member",
                                    value:
                                        `${member.user.tag} (${member.id})`
                                },

                                {
                                    name:
                                        "Inviter",
                                    value:
                                        inviter
                                            ? `${inviter.tag}`
                                            : "Unknown"
                                },

                                {
                                    name:
                                        "Invite Code",
                                    value:
                                        usedInvite.code
                                }
                            )

                            .setTimestamp();

                    await sendLog(
                        member.guild,
                        LOG_CHANNELS.INVITE,
                        logEmbed
                    );
                }

            } catch (e) {}
        }
    }
);

// =====================================================
// MEMBER LEAVE
// =====================================================

client.on(
    Events.GuildMemberRemove,
    async (member) => {

        if (
            GOODBYE_CHANNEL_ID
        ) {

            const channel =
                member.guild.channels.cache.get(
                    GOODBYE_CHANNEL_ID
                );

            if (channel) {

                const embed =
                    new EmbedBuilder()

                        .setTitle(
                            "Goodbye"
                        )

                        .setDescription(
                            `${member.user.tag} left the server.`
                        )

                        .setColor(
                            "#FF0000"
                        );

                channel.send({
                    embeds: [
                        embed
                    ]
                });
            }
        }
    }
);

// =====================================================
// GIVEAWAY END FUNCTION
// =====================================================

async function endGiveaway(
    messageId
) {

    const giveaway =
        activeGiveaways.get(
            messageId
        );

    if (!giveaway) return;

    const channel =
        client.channels.cache.get(
            giveaway.channelId
        );

    if (!channel) return;

    try {

        const msg =
            await channel.messages.fetch(
                messageId
            );

        const reactions =
            msg.reactions.cache.get(
                "🎉"
            );

        if (!reactions) {

            activeGiveaways.delete(
                messageId
            );

            return channel.send(
                "❌ No one participated in the giveaway."
            );
        }

        const users =
            await reactions.users.fetch();

        let participants =
            users
                .filter(
                    u =>
                        !u.bot
                )
                .map(
                    u =>
                        u.id
                );

        if (
            participants.length ===
            0
        ) {

            activeGiveaways.delete(
                messageId
            );

            return channel.send(
                "❌ No one participated in the giveaway."
            );
        }

        let winners =
            [];

        for (
            let i = 0;
            i < giveaway.winners;
            i++
        ) {

            if (
                participants.length ===
                0
            ) break;

            const winnerId =
                participants.splice(
                    Math.floor(
                        Math.random() *
                        participants.length
                    ),
                    1
                )[0];

            winners.push(
                `<@${winnerId}>`
            );
        }

        const embed =
            new EmbedBuilder()

                .setTitle(
                    "🎉 Giveaway Ended!"
                )

                .setColor(
                    "#FF0000"
                )

                .setDescription(
                    `**Prize:** ${giveaway.prize}\n**Winners:** ${winners.join(", ")}`
                );

        channel.send({
            embeds: [
                embed
            ]
        });

    } catch (e) {

        console.log(
            "Giveaway error"
        );
    }

    activeGiveaways.delete(
        messageId
    );
}

// =====================================================
// START BOT
// =====================================================

console.log(
    "SAM STUDIO Bot is ready with All Logs + Premium Ticket Panel + Advanced Anti-Ping + Invite Tracker!"
);

client.login(
    TOKEN
).catch(
    console.error
);
