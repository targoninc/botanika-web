import fs from "fs";
import {ModelCapability} from "../src/models-shared/llms/ModelCapability.ts";
import {ModelDefinition} from "../src/models-shared/llms/ModelDefinition.ts";

function getCapabilities(params: string[]) {
    let caps = [ModelCapability.streaming, ModelCapability.fileInput];

    if (params.includes("tool") && params.includes("tool_choice")) {
        caps.push(ModelCapability.tools);
    }

    return caps;
}

fetch("https://openrouter.ai/api/v1/models").then(async r => {
    const json = await r.json();

    const mapped = json.data.map(m => {
        return <ModelDefinition>{
            id: m.id,
            displayName: m.name,
            capabilities: getCapabilities(m.supported_parameters)
        }
    });
    fs.writeFileSync("./models.json", JSON.stringify(mapped, null, 2));
});

