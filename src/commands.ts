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
        min_length: 51,
        max_length: 51,
      },
      {
        type: ApplicationCommandOptionType.Boolean,
        name: "ephemeral",
        description: "Ephemeral message",
      },
    ],
  },
  {
    name: "masscheck",
    description: "Mass-check OpenAI Keys",
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: "key",
        description: "Keys. Split with , or line feed or \\n",
        required: true,
        min_length: 102,
      },
    ],
  },
];

export default commands;
