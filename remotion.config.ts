import { Config } from "@remotion/cli/config";

// Each concurrent frame is a headless Chrome tab; 2 is safe on a 16 GB laptop.
Config.setConcurrency(Number(process.env.PAPERTALK_CONCURRENCY) || 2);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
Config.setCrf(18);
Config.setOverwriteOutput(true);
