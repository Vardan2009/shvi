export { determinePlayer, play };

const determinePlayer = (filePath) => {
  switch (Deno.build.os) {
    case "darwin":
      return ["afplay", [filePath]];
    case "windows":
      return ["powershell", ["-c", "Start-Process", filePath]];
    default:
      return ["aplay", [filePath]];
  }
};

const play = async (filePath) => {
  const [player, args] = determinePlayer(filePath);

  const process = new Deno.Command(player, {
    args,
    stdout: "inherit",
    stderr: "inherit",
  }).spawn();

  await process.output();
};
