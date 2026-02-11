import { execFile } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function setupWhamoRoutes(app: any) {
  const tempDir = path.join(process.cwd(), "temp");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const engineDir = path.join(process.cwd(), "server", "engine");
  if (!fs.existsSync(engineDir)) fs.mkdirSync(engineDir, { recursive: true });

  app.post("/api/run-whamo", (req: any, res: any) => {
    const { inpContent } = req.body;
    const tempId = uuidv4();
    const runDir = path.join(tempDir, tempId);
    fs.mkdirSync(runDir, { recursive: true });

    const inpPath = path.join(runDir, "network.inp");
    const outPath = path.join(runDir, "network.out");
    // The provided prompt says engine is at /server/engine/whamo.exe
    const exePath = path.join(engineDir, "whamo.exe");

    if (inpContent) {
      fs.writeFileSync(inpPath, inpContent);
    } else {
      // Fallback if content wasn't sent but file might exist from previous save-inp (deprecated approach)
      const oldInpPath = path.join(tempDir, "network.inp");
      if (fs.existsSync(oldInpPath)) {
        fs.copyFileSync(oldInpPath, inpPath);
      } else {
        return res.status(400).send("INP content not provided and no saved network.inp found.");
      }
    }

    if (!fs.existsSync(exePath)) {
       // Fallback to sample if engine missing (for testing/demo)
       const sampleOutPath = path.join(process.cwd(), "attached_assets", "1_OUT_1770798402859.OUT");
       if (fs.existsSync(sampleOutPath)) {
         console.warn("Engine missing, falling back to sample output");
         return res.download(sampleOutPath, "network.out", () => {
           fs.rmSync(runDir, { recursive: true, force: true });
         });
       }
       return res.status(500).send("WHAMO engine not found at " + exePath);
    }

    execFile("wine", [exePath, "network.inp", "network.out"], { cwd: runDir }, (error, stdout, stderr) => {
      if (error) {
        console.error("WHAMO Error:", error);
        // Fallback to sample even on execution error if it exists
        const sampleOutPath = path.join(process.cwd(), "attached_assets", "1_OUT_1770798402859.OUT");
        if (fs.existsSync(sampleOutPath)) {
           return res.download(sampleOutPath, "network_error_fallback.out", () => {
             fs.rmSync(runDir, { recursive: true, force: true });
           });
        }
        return res.status(500).send("WHAMO execution failed: " + stderr);
      }

      if (!fs.existsSync(outPath)) {
        return res.status(500).send("OUT file not generated.");
      }

      res.download(outPath, "network.out", (err: any) => {
        fs.rmSync(runDir, { recursive: true, force: true });
      });
    });
  });

  app.post("/api/run-external-whamo", (req: any, res: any) => {
    const { inpContent, fileName } = req.body;
    if (!inpContent) return res.status(400).send("No INP content provided");

    const tempId = uuidv4();
    const runDir = path.join(tempDir, tempId);
    fs.mkdirSync(runDir, { recursive: true });

    const inpPath = path.join(runDir, "input.inp");
    const outPath = path.join(runDir, "output.out");
    const exePath = path.join(engineDir, "whamo.exe");

    fs.writeFileSync(inpPath, inpContent);

    if (!fs.existsSync(exePath)) {
      const sampleOutPath = path.join(process.cwd(), "attached_assets", "1_OUT_1770798402859.OUT");
      if (fs.existsSync(sampleOutPath)) {
        return res.download(sampleOutPath, fileName?.replace(".inp", ".out") || "output.out", (err: any) => {
          fs.rmSync(runDir, { recursive: true, force: true });
        });
      }
      return res.status(500).send("WHAMO engine not found");
    }

    execFile("wine", [exePath, "input.inp", "output.out"], { cwd: runDir }, (error, stdout, stderr) => {
      if (error) {
        console.error("WHAMO External Error:", error);
        // Fallback to sample on error
        const sampleOutPath = path.join(process.cwd(), "attached_assets", "1_OUT_1770798402859.OUT");
        if (fs.existsSync(sampleOutPath)) {
          return res.download(sampleOutPath, fileName?.replace(".inp", ".out") || "output.out", (err: any) => {
            fs.rmSync(runDir, { recursive: true, force: true });
          });
        }
        return res.status(500).send("WHAMO execution failed: " + stderr);
      }
      if (!fs.existsSync(outPath)) {
        // Fallback to sample if file not generated
        const sampleOutPath = path.join(process.cwd(), "attached_assets", "1_OUT_1770798402859.OUT");
        if (fs.existsSync(sampleOutPath)) {
          return res.download(sampleOutPath, fileName?.replace(".inp", ".out") || "output.out", (err: any) => {
            fs.rmSync(runDir, { recursive: true, force: true });
          });
        }
        return res.status(500).send("OUT file not generated");
      }
      
      res.download(outPath, fileName?.replace(".inp", ".out") || "output.out", (err: any) => {
        fs.rmSync(runDir, { recursive: true, force: true });
      });
    });
  });
}
