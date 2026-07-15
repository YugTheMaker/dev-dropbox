cask "dev-dropbox" do
  version "1.3.0"
  
  if Hardware::CPU.intel?
    # Replace with the actual hash of your Intel DMG when compiled on an Intel runner
    sha256 "REPLACE_WITH_INTEL_SHA256_HASH"
    url "https://github.com/YugTheMaker/dev-dropbox/releases/download/v#{version}/dev-dropbox_#{version}_x64.dmg"
  else
    sha256 "beb08a3ee71cf8846aaf59b889a146f3bf78a2fb28d4ef74e4b0d83cc2a28ff3"
    url "https://github.com/YugTheMaker/dev-dropbox/releases/download/v#{version}/dev-dropbox_#{version}_aarch64.dmg"
  end

  name "Dev Dropbox"
  desc "Auto-syncing folder experience for Git projects"
  homepage "https://github.com/YugTheMaker/dev-dropbox"

  app "dev-dropbox.app"

  # Bypasses the macOS Gatekeeper warning by stripping the quarantine flag upon install
  postflight do
    system_command "/usr/bin/xattr",
                   args: ["-cr", "#{appdir}/dev-dropbox.app"],
                   sudo: false
  end
end
