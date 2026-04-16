const IMGBB_KEY = "d55606e9af82af18c79fa1d3d525d938";

export async function uploadImageToImgbb(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("image", file);

  const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`imgbb upload failed: ${res.status}`);
  }

  const data = await res.json();
  if (!data.success) {
    throw new Error("imgbb upload unsuccessful");
  }

  return data.data.url as string;
}
