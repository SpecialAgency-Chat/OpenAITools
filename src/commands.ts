import {
  ApplicationCommandOptionType,
  RESTPostAPIApplicationCommandsJSONBody,
} from "discord-api-types/v10";

const commands: RESTPostAPIApplicationCommandsJSONBody[] = [
  {
    name: "ping",
    description: "Respond with Pong",
  },
  {
    name: "check",
    description: "Check OpenAI Keys",
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: "key",
        description: "An OpenAI' Key",
        required: true,
        min_length: 40,
        max_length: 60,
      },
      {
        type: ApplicationCommandOptionType.Boolean,
        name: "ephemeral",
        description: "Ephemeral message",
      },
    ],
  },
];

export default commands;
