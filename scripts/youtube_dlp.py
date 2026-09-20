#!/usr/bin/env python3
"""yt-dlp CLI wrapper used by the NSU download API.

Commands:
  formats <videoId>
      Prints a JSON bundle describing the downloadable formats for a video.

  download --id <videoId> --itag <itag> --output <mp3|mp4|wav|m4a|aac>
           --bitrate <kbps> --out <output-prefix> [--ffmpeg-location <path>]
      Downloads the video/audio and writes the final file as <prefix>.<ext>.
      Prints a JSON status object to stdout when finished.

Everything is printed as JSON on stdout and errors as JSON on stderr so the
Node runtime can parse the result reliably.
"""

import argparse
import contextlib
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import NoReturn


def has_ytdlp() -> bool:
    """Check if a standalone yt-dlp binary is available on PATH."""
    try:
        subprocess.run(
            ["yt-dlp", "--version"],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return True
    except (subprocess.SubprocessError, OSError):
        return False


def probe_module_ytdlp() -> bool:
    """Check if the yt-dlp Python module (python3 -m yt_dlp) is available."""
    if not sys.executable:
        return False
    try:
        subprocess.run(
            [sys.executable, "-m", "yt_dlp", "--version"],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return True
    except (subprocess.SubprocessError, OSError):
        return False


def resolve_ytdlp() -> list:
    """
    Resolve how to invoke yt-dlp. Prefer the standalone binary and fall back
    to running the yt-dlp Python module (python3 -m yt_dlp).
    """
    if has_ytdlp():
        return ["yt-dlp"]

    if probe_module_ytdlp():
        return [sys.executable, "-m", "yt_dlp"]

    return ["yt-dlp"]


YTDLP = resolve_ytdlp()


def base_options() -> list:
    return ["--no-playlist", "--no-warnings", "--no-color", "--quiet", "--no-progress"]


def download_options() -> list:
    return ["--no-playlist", "--no-warnings", "--no-color", "--newline"]


def error_payload(message: str, detail: str = "") -> dict:
    return {
        "status": "error",
        "error": message,
        "detail": (detail or "").strip()[:2000],
    }


def emit_error(payload: dict, code: int = 70) -> NoReturn:
    sys.stderr.write(json.dumps(payload))
    sys.stderr.flush()
    sys.exit(code)


def run_ytdlp(args: list) -> subprocess.CompletedProcess:
    return subprocess.run(
        YTDLP + args,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )


def run_download_command(command: list) -> None:
    """Run yt-dlp for a download, relaying download progress to stdout as
    newline-delimited JSON so the Node runtime can stream live progress back
    to the browser."""
    process = subprocess.Popen(
        YTDLP + command,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if process.stdout is None:
        raise RuntimeError("yt-dlp did not expose a readable stdout stream.")

    last_lines = []
    last_percent = -1.0
    for out_line in process.stdout:
        last_lines.append(out_line)
        if len(last_lines) > 40:
            last_lines.pop(0)
        match = re.search(r"\[download\]\s*([\d.]+)%", out_line)
        if not match:
            continue
        percent = float(match.group(1))
        if percent <= last_percent:
            continue
        last_percent = percent
        sys.stdout.write(
            json.dumps({"type": "progress", "percent": round(percent, 1)}) + "\n"
        )
        sys.stdout.flush()

    return_code = process.wait()
    if return_code != 0:
        raise RuntimeError(
            last_lines[-1].strip()
            if last_lines
            else f"yt-dlp exited with code {return_code}."
        )


def format_size(format_obj: dict):
    size = (
        format_obj.get("filesize")
        or format_obj.get("filesize_approx")
        or 0
    )
    try:
        return int(size)
    except (TypeError, ValueError, OverflowError):
        return None


def format_itag(format_obj: dict) -> int:
    format_id = str(format_obj.get("format_id") or "")
    return int(format_id) if format_id.isdigit() else 0


def format_height(format_obj: dict) -> int:
    return int(format_obj.get("height") or 0)


def has_audio(format_obj: dict) -> bool:
    return bool(format_obj.get("acodec")) and format_obj.get("acodec") != "none"


def has_video(format_obj: dict) -> bool:
    return bool(format_obj.get("vcodec")) and format_obj.get("vcodec") != "none"


def format_ext(format_obj: dict) -> str:
    return str(format_obj.get("ext") or "")


def format_bitrate(format_obj: dict) -> int:
    return int(
        format_obj.get("abr") or format_obj.get("tbr") or format_obj.get("vbr") or 0
    )


def fetch_json_info(video_id: str) -> dict:
    result = run_ytdlp(
        [
            *base_options(),
            f"https://www.youtube.com/watch?v={video_id}",
            "--dump-json",
            "--skip-download",
        ]
    )
    if result.returncode != 0 or not result.stdout.strip():
        emit_error(
            error_payload(
                "The video could not be accessed from this server.",
                result.stderr or f"yt-dlp exited with code {result.returncode}.",
            ),
            71,
        )
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        emit_error(
            error_payload(
                "yt-dlp returned an unreadable response for this video.",
                result.stdout[:2000],
            )
        )


def cmd_formats(video_id: str):
    info = fetch_json_info(video_id)

    formats = info.get("formats") or []
    audio_only = [
        fmt
        for fmt in formats
        if has_audio(fmt) and not has_video(fmt) and format_itag(fmt) > 0
    ]
    audio_only.sort(key=format_bitrate, reverse=True)
    audio_source = audio_only[0] if audio_only else None

    combined: dict[int, dict] = {}
    video_only: dict[int, dict] = {}
    for fmt in formats:
        if (
            format_itag(fmt) > 0
            and format_ext(fmt) == "mp4"
            and format_height(fmt) >= 360
            and has_video(fmt)
        ):
            render = (combined if has_audio(fmt) else video_only)
            render[format_height(fmt)] = fmt

    result = []
    if audio_source and format_itag(audio_source) > 0:
        result.append(
            {
                "itag": format_itag(audio_source),
                "label": "MP3 192 kbps",
                "kind": "audio",
                "extension": "mp3",
                "outputBitrate": 192,
                "size": format_size(audio_source),
            }
        )

    for height in sorted(set(combined) | set(video_only)):
        source = combined.get(height) or video_only.get(height)
        if source is None:
            continue
        result.append(
            {
                "itag": format_itag(source),
                "label": f"{height}p",
                "kind": "video+audio" if height in combined else "video",
                "extension": "mp4",
                "size": format_size(source),
            }
        )

    return {
        "status": "done",
        "videoId": video_id,
        "title": info.get("title") or f"youtube-{video_id}",
        "formats": result,
    }


AUDIO_EXTS = {
    "mp3": "mp3",
    "wav": "wav",
    "m4a": "m4a",
    "aac": "m4a",
}

CONTENT_TYPES = {
    "mp3": "audio/mpeg",
    "wav": "audio/wav",
    "m4a": "audio/mp4",
    "aac": "audio/aac",
    "mp4": "video/mp4",
}


def find_format(info: dict, itag: int):
    for fmt in info.get("formats") or []:
        if format_itag(fmt) == itag:
            return fmt
    return None


IGNORED_FILE_SUFFIXES = (".part", ".ytdl", ".info.json", ".live_chat.json")


def is_incomplete_or_sidecar(path: str) -> bool:
    return any(path.endswith(suffix) for suffix in IGNORED_FILE_SUFFIXES)


def locate_produced_file(out_prefix: str, format_ext: str) -> Path:
    prefix = Path(out_prefix)
    parent = prefix.parent

    exact = sorted(parent.glob(f"{prefix.name}.{format_ext}"))
    if exact and not is_incomplete_or_sidecar(exact[0].name):
        return exact[0].resolve()

    for candidate in sorted(parent.glob(f"{prefix.name}.*")):
        if not is_incomplete_or_sidecar(candidate.name):
            return candidate.resolve()

    raise RuntimeError("yt-dlp finished without producing an output file.")


def clean_sidecars(produced: Path, out_prefix: str) -> None:
    prefix_name = Path(out_prefix).name
    for candidate in produced.parent.iterdir():
        if candidate == produced:
            continue
        if candidate.name.startswith(prefix_name):
            with contextlib.suppress(OSError):
                candidate.unlink()


def cmd_download(video_id, itag, output, bitrate, out_prefix, ffmpeg_location):
    if output == "mp4" and itag <= 0:
        raise ValueError("A valid --itag is required for video downloads.")

    info = fetch_json_info(video_id)
    selected = find_format(info, itag) if itag > 0 else None

    command = [
        *download_options(),
        f"https://www.youtube.com/watch?v={video_id}",
    ]
    if ffmpeg_location:
        command += ["--ffmpeg-location", ffmpeg_location]
    command += ["-o", f"{out_prefix}.%(ext)s"]

    if output in AUDIO_EXTS:
        format_spec = str(itag) if selected is not None else "bestaudio/best"
        command += [
            "-f",
            format_spec,
            "--extract-audio",
            "--audio-format",
            AUDIO_EXTS[output],
        ]
        if output in ("mp3", "m4a", "aac"):
            command += ["--audio-quality", str(bitrate)]
        format_ext = AUDIO_EXTS[output]
    else:
        if selected is None:
            raise ValueError(
                f"Requested format itag {itag} is not available for {video_id}."
            )
        format_spec = (
            str(itag)
            if has_audio(selected) and has_video(selected)
            else f"{itag}+bestaudio/best"
        )
        command += ["-f", format_spec, "--merge-output-format", "mp4"]
        format_ext = "mp4"

    run_download_command(command)

    produced = locate_produced_file(out_prefix, format_ext)
    if not produced.exists():
        raise RuntimeError(
            f"yt-dlp reported an output file that does not exist: {produced}"
        )

    clean_sidecars(produced, out_prefix)

    return {
        "status": "done",
        "videoId": video_id,
        "title": info.get("title") or f"youtube-{video_id}",
        "file": str(produced),
        "size": produced.stat().st_size,
        "contentType": CONTENT_TYPES.get(format_ext, "application/octet-stream"),
    }


def main(argv):
    parser = argparse.ArgumentParser(description="NSU YouTube download helper.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    formats_parser = subparsers.add_parser("formats")
    formats_parser.add_argument("video_id")

    download_parser = subparsers.add_parser("download")
    download_parser.add_argument("--id", dest="video_id", required=True)
    download_parser.add_argument("--itag", type=int, default=0)
    download_parser.add_argument("--output", default="mp3")
    download_parser.add_argument("--bitrate", type=int, default=192)
    download_parser.add_argument("--out", dest="out_prefix", required=True)
    download_parser.add_argument(
        "--ffmpeg-location", dest="ffmpeg_location", default=None
    )

    args = parser.parse_args(argv)

    if args.command == "formats":
        payload = cmd_formats(args.video_id)
    else:
        payload = cmd_download(
            args.video_id,
            args.itag,
            args.output,
            args.bitrate,
            args.out_prefix,
            args.ffmpeg_location,
        )

    sys.stdout.write(json.dumps(payload) + "\n")
    sys.stdout.flush()
    return 0


def run(argv):
    try:
        return main(argv)
    except Exception as error:  # noqa: BLE001 - always surface failures as JSON for Node
        emit_error(error_payload(str(error)))


if __name__ == "__main__":
    sys.exit(run(sys.argv[1:]))
