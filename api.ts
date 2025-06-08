import {apiServer} from "./src/api/api-server.ts";
import {CLI} from "./src/api/CLI.ts";

CLI.debug(`Starting API...`);
apiServer().then(() => {
    CLI.success(`API started!`);
});