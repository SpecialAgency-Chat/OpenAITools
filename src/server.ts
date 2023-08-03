import { Hono } from "hono";
import { verifyDiscordRequest } from "@/verifyDiscordRequest";
import {
  InteractionResponseType,
  InteractionType,
  MessageFlags,
} from "discord-api-types/v10";
import { getLogger } from "./logger";
import { isChatInputApplicationCommandInteraction } from "discord-api-types/utils/v10";
import {
  APIApplicationCommandInteractionDataOption,
  APIApplicationCommandInteractionDataStringOption,
  APIApplicationCommandInteractionDataBooleanOption,
  ApplicationCommandOptionType,
} from "discord-api-types/v10";

const isString = (
  option: APIApplicationCommandInteractionDataOption,
): option is APIApplicationCommandInteractionDataStringOption => {
  return option.type === ApplicationCommandOptionType.String;
};
const isBoolean = (
  option: APIApplicationCommandInteractionDataOption,
): option is APIApplicationCommandInteractionDataBooleanOption => {
  return option.type === ApplicationCommandOptionType.Boolean;
};

const app = new Hono();

const logger = getLogger("Server");

app.get("/", async (c) => {
  return c.text(`Hello! Client ID: ${c.env?.DISCORD_CLIENT_ID}`);
});

app.post("/interactions", async (c) => {
  logger.debug("Received request");
  logger.trace(c);
  const { isValid, interaction } = await verifyDiscordRequest(c);
  if (!isValid) {
    logger.debug("Invalid request");
    c.status(400);
    return c.json({ error: "Invalid request" });
  }
  if (interaction.type === InteractionType.Ping) {
    // Handle ping
    logger.debug("Handling ping");
    return c.json({ type: InteractionResponseType.Pong });
  }
  if (interaction.type === InteractionType.ApplicationCommand) {
    if (isChatInputApplicationCommandInteraction(interaction)) {
      switch (interaction.data.name.toLowerCase()) {
        case "ping": {
          logger.debug("handling ping interaction");
          return c.json({
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
              content: "Pong!",
              flags: MessageFlags.Ephemeral,
            },
          });
        }
        case "check": {
          logger.debug("handling check interaction");
          const api = interaction.data.options?.filter(isString)[0];
          const ephemeral = interaction.data.options?.filter(isBoolean)[0]
            ?.value
            ? MessageFlags.Ephemeral
            : 0;
          logger.debug(api);
          logger.debug(ephemeral);
          const [data, emptyData] = await Promise.all([
            fetch("https://api.openai.com/v1/models", {
              headers: {
                Authorization: `Bearer ${api?.value}`,
              },
            }),
            fetch("https://api.openai.com/v1/chat/completions", {
              headers: {
                Authorization: `Bearer ${api?.value}`,
                "Content-Type": "application/json",
              },
              method: "POST",
              body: JSON.stringify({ model: "gpt-3.5-turbo" }),
            }),
          ]);
          const jsonData = await data.json();
          const emptyJsonData = await emptyData.json();
          logger.debug(jsonData);
          logger.debug(emptyJsonData);
          if (jsonData.error) {
            if (jsonData.error.code === "invalid_api_key") {
              return c.json({
                type: InteractionResponseType.ChannelMessageWithSource,
                data: {
                  embeds: [
                    {
                      color: 0xff0000,
                      description: "Incorrect API Key provided - Maybe revoked",
                    },
                  ],
                  flags: ephemeral,
                },
              });
            } else {
              return c.json({
                type: InteractionResponseType.ChannelMessageWithSource,
                data: {
                  embeds: [
                    {
                      color: 0xff0000,
                      description:
                        "Unexpected Error - " + jsonData.error.message,
                    },
                  ],
                  flags: ephemeral,
                },
              });
            }
          }
          logger.debug("Not Error");
          if (
            emptyJsonData.error &&
            emptyJsonData.error.code === "insufficient_quota"
          ) {
            return c.json({
              type: InteractionResponseType.ChannelMessageWithSource,
              data: {
                embeds: [
                  {
                    color: 0xff0000,
                    description: "Exceeded current quota - No money",
                  },
                ],
                flags: ephemeral,
              },
            });
          }
          logger.debug("Quota");
          if (data.status === 429) {
            return c.json({
              type: InteractionResponseType.ChannelMessageWithSource,
              data: {
                content: "429: Please try again.",
                flags: ephemeral,
              },
            });
          }
          logger.debug("Not 429");
          const models = jsonData.data
            .filter((x: { object: "model" }) => x.object === "model")
            .map((x: { id: string }) => x.id);
          logger.debug({
            embeds: [
              {
                color: 0x00ff00,
                description: "Available",
                fields: [
                  {
                    name: "GPT-4",
                    value: `${models.includes("gpt-4") ? "🟢" : "🔴"}`,
                    inline: true,
                  },
                  {
                    name: "Usable models",
                    value: models.join(",") || "None",
                    inline: true,
                  },
                ],
              },
            ],
            flags: ephemeral,
          });
          return c.json({
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
              embeds: [
                {
                  color: 0x00ff00,
                  description: "Available",
                  fields: [
                    {
                      name: "GPT-4",
                      value: `${models.includes("gpt-4") ? "🟢" : "🔴"}`,
                      inline: true,
                    },
                    {
                      name: "Usable models",
                      value: models.join(",") || "None",
                      inline: true,
                    },
                  ],
                },
              ],
              flags: ephemeral,
            },
          });
        }
      }
    }
  }

  // Unknown interaction type
  return c.json({ error: "Unknown Interaction type" });
});

export default app;
