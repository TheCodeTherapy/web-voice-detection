export const defaultModelFetcher = async (path: string) => {
  const model = await fetch(path);
  return await model.arrayBuffer();
};
