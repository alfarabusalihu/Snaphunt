import { resetCollection } from "../../rag/vector.js";

export const systemTool = {
    name: "reset_system",
    description: "Reset the entire vector collection and clear internal document registry.",
    run: async () => {
        try {
            await resetCollection();
            return { status: "success", message: "System reset complete. All vectors purged." };
        } catch (error) {
            return { status: "error", message: String(error) };
        }
    }
};
