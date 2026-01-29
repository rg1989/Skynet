# 3D Avatar Setup

The Skynet dashboard supports 3D talking avatars using the [TalkingHead](https://github.com/met4citizen/TalkingHead) library.

## Getting a 3D Avatar

The 3D avatar feature requires a GLB file with specific blend shapes for lip-sync. Here's how to get one:

### Option 1: Ready Player Me (Recommended)

1. Go to [Ready Player Me](https://readyplayer.me/avatar/) and create your avatar
2. Copy your avatar's unique ID from the URL (e.g., `64bfa15f0e72c63d7c3934a6`)
3. Download the GLB file using this URL format:

```
https://models.readyplayer.me/YOUR_AVATAR_ID.glb?morphTargets=ARKit,Oculus+Visemes,mouthOpen,mouthSmile,eyesClosed,eyesLookUp,eyesLookDown&textureSizeLimit=1024&textureFormat=png
```

4. Save the file as `avatar-3d.glb` in this folder (`web/public/avatars/`)

### Option 2: PlayerZero (Ready Player Me)

1. Go to [PlayerZero](https://playerzero.readyplayer.me/)
2. Create your avatar
3. Download using:

```
https://avatars.readyplayer.me/YOUR_AVATAR_ID.glb?morphTargetsGroup=ARKit,Oculus+Visemes&morphTargets=mouthSmile,mouthOpen,eyesClosed,eyesLookUp,eyesLookDown&textureSizeLimit=1024&textureFormat=png
```

4. Save as `avatar-3d.glb` in this folder

### Option 3: Custom GLB Avatar

You can use any GLB avatar that has:
- **Mixamo-compatible rig** (bone structure)
- **ARKit blend shapes** (52 facial expressions)
- **Oculus visemes** (15 mouth shapes for lip-sync)

Tools for creating compatible avatars:
- [MPFB](https://static.makehumancommunity.org/mpfb.html) - Free Blender extension
- [Avaturn](https://avaturn.me) - Web-based avatar creator
- [Avatar SDK](https://avatarsdk.com) - Photo-based avatar generation

## File Location

Place your avatar file at:
```
web/public/avatars/avatar-3d.glb
```

## Troubleshooting

### Avatar not loading
- Check browser console for errors
- Verify the file exists at `/avatars/avatar-3d.glb`
- Ensure the file has the required blend shapes

### Lip-sync not working
- Make sure your avatar has Oculus visemes blend shapes
- The current implementation uses mood-based animation since Web Speech API doesn't provide word timestamps

### Performance issues
- Try a lower resolution texture (change `textureSizeLimit=512`)
- Use LOD (level of detail) with `lod=1` or `lod=2` in the download URL

## License Notes

- **Ready Player Me avatars**: Free for non-commercial use under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/)
- For commercial use, check the specific terms of your avatar provider
