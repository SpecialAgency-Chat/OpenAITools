import { Hono } from "hono";
import { verifyDiscordRequest } from "@/verifyDiscordRequest";
import {
  ButtonStyle,
  ComponentType,
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
            .filter(
              (x: { object: "model"; id: string }) =>
                x.object === "model" && x.id.startsWith("gpt"),
            )
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
        case "masscheck": {
          logger.debug("handling masscheck interaction");
          const api = interaction.data.options?.filter(isString)[0];
          logger.debug(api);
          const keys = api!.value.split(/,|\n|\\n/);
          const responses = await Promise.all(
            keys.map((x) => {
              return fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${x}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ model: "gpt-3.5-turbo" }),
              });
            }),
          );
          const responsesJson = await Promise.all(
            responses.map((x) => x.json()),
          );
          const results: any[] = [];
          responsesJson.forEach((result, i) => {
            if (result.error && result.error.code === "invalid_api_key") {
              results.push({
                key: keys[i],
                available: false,
                gpt4: false,
                reason: "Invalid API Key",
              });
            } else if (result.error.code === "insufficient_quota") {
              results.push({
                key: keys[i],
                available: false,
                gpt4: false,
                reason: "Exceeded quota",
              });
            } else if (responses[i].status === 429) {
              results.push({
                key: keys[i],
                available: false,
                gpt4: false,
                reason: "Server Error - 429",
              });
            } else if (result.error) {
              results.push({
                key: keys[i],
                available: false,
                gpt4: false,
                reason: result.error.message,
              });
            } else {
              results.push({
                key: keys[i],
                available: true,
                gpt4: false,
                reason: "",
              });
            }
          });
          return c.json({
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
              embeds: [
                {
                  description: results
                    .map(
                      (x) =>
                        `*${x.key}* - ${x.available ? "🟢" : "🔴"} ${x.reason}`,
                    )
                    .join("\n"),
                },
              ],
              components: [
                {
                  type: ComponentType.ActionRow,
                  components: [
                    {
                      type: ComponentType.Button,
                      label: "Check GPT-4",
                      custom_id: "gpt4",
                      style: ButtonStyle.Secondary,
                    },
                  ],
                },
              ],
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
