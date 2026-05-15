// ============================================ //
// IPFS FUNCTIONS
// ============================================ //

import { apiFetch } from './api.js';
import { showToast, showProgress, setProgress, hideProgress } from './ui.js';
import { PINATA_GATEWAY } from './config.js';
import { UI } from './state.js';

export function showIPFSPreview(imageURL, videoURL, metadataURL) {
  if (UI.previewImage) {
    UI.previewImage.innerHTML = '';
    UI.previewVideo.innerHTML = '';
    UI.previewMetadata.innerHTML = '';
    if (imageURL) UI.previewImage.innerHTML = `🖼️ Image: <a href="${PINATA_GATEWAY}${imageURL.cid}" target="_blank">${imageURL.cid.substring(0, 20)}...</a>`;
    if (videoURL) UI.previewVideo.innerHTML = `🎬 Video: <a href="${PINATA_GATEWAY}${videoURL.cid}" target="_blank">${videoURL.cid.substring(0, 20)}...</a>`;
    if (metadataURL) UI.previewMetadata.innerHTML = `📄 Metadata: <a href="${PINATA_GATEWAY}${metadataURL.cid}" target="_blank">${metadataURL.cid.substring(0, 20)}...</a>`;
    if (UI.ipfsPreview) UI.ipfsPreview.style.display = 'block';
    setTimeout(() => { if (UI.ipfsPreview) UI.ipfsPreview.style.display = 'none'; }, 10000);
  }
}

export async function uploadFileToIPFS(file) {
  showToast('Getting upload permission...', 'info');
  
  const tokenRes = await apiFetch('/api/getUploadToken', {
    method: 'POST'
  });
  
  if (!tokenRes.ok) {
    const errorText = await tokenRes.text();
    console.error('GetUploadToken error:', tokenRes.status, errorText);
    throw new Error(`Failed to get upload permission: ${tokenRes.status}`);
  }
  
  const tokenData = await tokenRes.json();
  
  if (!tokenData.token) {
    throw new Error("No token received from server");
  }
  
  showToast('Uploading file to IPFS...', 'info');
  
  const formData = new FormData();
  formData.append('file', file);
  
  const uploadRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenData.token}` },
    body: formData
  });
  
  if (!uploadRes.ok) {
    const errorText = await uploadRes.text();
    console.error('Pinata upload error:', errorText);
    throw new Error(`Pinata upload failed: ${uploadRes.status}`);
  }
  
  const result = await uploadRes.json();
  if (!result.IpfsHash) throw new Error("Upload failed - no IPFS hash");
  
  console.log("File uploaded:", result.IpfsHash);
  
  return { 
    success: true,
    ipfs: `ipfs://${result.IpfsHash}`,
    cid: result.IpfsHash
  };
}

export async function uploadMetadataToIPFS(metadata) {
  showToast('Preparing metadata...', 'info');
  
  const response = await apiFetch('/api/uploadMetadataToIPFS', {
    method: 'POST',
    body: JSON.stringify(metadata)
  });
  
  if (!response.ok) throw new Error(`Metadata upload failed: ${response.status}`);
  
  showToast('Metadata uploaded!', 'success');
  return await response.json();
}

export async function uploadImageToIPFS(canvas) {
  showToast('Preparing image...', 'info');
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) { reject(new Error('Failed to create image')); return; }
      const file = new File([blob], `snapshot_${Date.now()}.png`, { type: 'image/png' });
      try { 
        showToast('Uploading image...', 'info'); 
        resolve(await uploadFileToIPFS(file)); 
      } catch (error) { reject(error); }
    }, 'image/png');
  });
}

export async function uploadVideoToIPFS(stream, duration = 15000) {
  showToast('Recording video...', 'info');
  let mimeType = 'video/webm';
  if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/mp4';
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks = [];
  return new Promise((resolve, reject) => {
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    recorder.onstop = async () => {
      const ext = mimeType === 'video/mp4' ? 'mp4' : 'webm';
      const blob = new Blob(chunks, { type: mimeType });
      const file = new File([blob], `video_${Date.now()}.${ext}`, { type: mimeType });
      try { 
        showToast('Uploading video...', 'info'); 
        resolve(await uploadFileToIPFS(file)); 
      } catch (error) { reject(error); }
    };
    recorder.onerror = (err) => reject(err);
    recorder.start(1000);
    setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, duration);
  });
}
