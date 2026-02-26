# `actions/attest`

Generate signed attestations for workflow artifacts. Internally powered by the
[@actions/attest][1] package.

Attestations bind some subject (a named artifact along with its digest) to a
predicate (some assertion about that subject) using the [in-toto][2] format.
[Predicates][3] consist of a type URI and a JSON object containing
type-dependent parameters.

A verifiable signature is generated for the attestation using a short-lived
[Sigstore][4]-issued signing certificate. If the repository initiating the
GitHub Actions workflow is public, the public-good instance of Sigstore will be
used to generate the attestation signature. If the repository is
private/internal, it will use the GitHub private Sigstore instance.

Once the attestation has been created and signed, it will be uploaded to the GH
attestations API and associated with the repository from which the workflow was
initiated.

When an attestation is created, the attestation is stored on the local
filesystem used by the runner. For each attestation created, the filesystem path
will be appended to the file `${RUNNER_TEMP}/created_attestation_paths.txt`.
This can be used to gather all attestations created by all jobs during a the
workflow.

Attestations can be verified using the [`attestation` command in the GitHub
CLI][5].

See [Using artifact attestations to establish provenance for builds][9] for more
information on artifact attestations.

<!-- prettier-ignore-start -->
> [!NOTE]
> Artifact attestations are available in public repositories for all
> current GitHub plans.
>
> To use artifact attestations in private or internal repositories, you must
> be on a GitHub Enterprise Cloud plan.
>
> Artifact attestations are NOT supported on GitHub Enterprise Server.
<!-- prettier-ignore-end -->

## Attestation Modes

This action supports three attestation modes, automatically detected based on
the inputs you provide:

<!-- markdownlint-disable MD013 -->

| Mode           | When Used                                              | Description                                     |
| -------------- | ------------------------------------------------------ | ----------------------------------------------- |
| **Provenance** | No `sbom-path` or predicate inputs                     | Auto-generates [SLSA build provenance][10]      |
| **SBOM**       | `sbom-path` is provided                                | Creates attestation from SPDX or CycloneDX SBOM |
| **Custom**     | `predicate-type`/`predicate`/`predicate-path` provided | User-supplied predicate                         |

<!-- markdownlint-enable MD013 -->

## Usage

Within the GitHub Actions workflow which builds some artifact you would like to
attest:

1. Ensure that the following permissions are set:

   ```yaml
   permissions:
     id-token: write
     attestations: write
     artifact-metadata: write
   ```

   The `id-token` permission gives the action the ability to mint the OIDC token
   necessary to request a Sigstore signing certificate. The `attestations`
   permission is necessary to persist the attestation. The `artifact-metadata`
   permission is necessary to create the artifact storage record.

1. Add the following to your workflow after your artifact has been built:

   ```yaml
   - uses: actions/attest@v4
     with:
       subject-path: '<PATH TO ARTIFACT>'
   ```

   By default, this generates a [SLSA build provenance][10] attestation. For
   SBOM or custom attestations, see the [Attestation Modes](#attestation-modes)
   section.

### Inputs

See [action.yml](action.yml)

```yaml
- uses: actions/attest@v4
  with:
    # Path to the artifact serving as the subject of the attestation. Must
    # specify exactly one of "subject-path", "subject-digest", or
    # "subject-checksums". May contain a glob pattern or list of paths
    # (total subject count cannot exceed 1024).
    subject-path:

    # SHA256 digest of the subject for the attestation. Must be in the form
    # "sha256:hex_digest" (e.g. "sha256:abc123..."). Must specify exactly one
    # of "subject-path", "subject-digest", or "subject-checksums".
    subject-digest:

    # Subject name as it should appear in the attestation. Required when
    # identifying the subject with the "subject-digest" input.
    subject-name:

    # Path to checksums file containing digest and name of subjects for
    # attestation. Must specify exactly one of "subject-path", "subject-digest",
    # or "subject-checksums".
    subject-checksums:

    # Path to the JSON-formatted SBOM file (SPDX or CycloneDX) to attest.
    # File size cannot exceed 16MB. When provided, creates an SBOM attestation.
    # Cannot be used together with "predicate-type", "predicate", or
    # "predicate-path".
    sbom-path:

    # URI identifying the type of the predicate. Required when using "predicate"
    # or "predicate-path" for custom attestations.
    predicate-type:

    # String containing the value for the attestation predicate. String length
    # cannot exceed 16MB. Must supply exactly one of "predicate-path" or
    # "predicate" when creating custom attestations.
    predicate:

    # Path to the file which contains the content for the attestation predicate.
    # File size cannot exceed 16MB. Must supply exactly one of "predicate-path"
    # or "predicate" when creating custom attestations.
    predicate-path:

    # Whether to push the attestation to the image registry. Requires that the
    # "subject-name" parameter specify the fully-qualified image name and that
    # the "subject-digest" parameter be specified. Defaults to false.
    push-to-registry:

    # Whether to create a storage record for the artifact.
    # Requires that push-to-registry is set to true.
    # Requires that the "subject-name" parameter specify the fully-qualified
    # image name. Defaults to true.
    create-storage-record:

    # Whether to attach a list of generated attestations to the workflow run
    # summary page. Defaults to true.
    show-summary:

    # The GitHub token used to make authenticated API requests. Default is
    # ${{ github.token }}
    github-token:
```

### Outputs

<!-- markdownlint-disable MD013 -->

| Name                 | Description                                                    | Example                                          |
| -------------------- | -------------------------------------------------------------- | ------------------------------------------------ |
| `attestation-id`     | GitHub ID for the attestation                                  | `123456`                                         |
| `attestation-url`    | URL for the attestation summary                                | `https://github.com/foo/bar/attestations/123456` |
| `bundle-path`        | Absolute path to the file containing the generated attestation | `/tmp/attestation.json`                          |
| `storage-record-ids` | GitHub IDs for the storage records                             | `987654`                                         |

<!-- markdownlint-enable MD013 -->

Attestations are saved in the JSON-serialized [Sigstore bundle][6] format.

If multiple subjects are being attested at the same time, a single attestation
will be created with references to each of the supplied subjects.

## Attestation Limits

### Subject Limits

No more than 1024 subjects can be attested at the same time.

### Predicate Limits

Whether supplied via the `predicate` or `predicatePath` input, the predicate
string cannot exceed 16MB.

## Examples

### Provenance Attestation (Default)

The simplest use case - just specify the artifact path and a SLSA build
provenance attestation is automatically generated:

```yaml
name: build-attest-provenance

on:
  workflow_dispatch:

jobs:
  build:
    permissions:
      id-token: write
      contents: read
      attestations: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Build artifact
        run: make my-app
      - name: Attest
        uses: actions/attest@v4
        with:
          subject-path: '${{ github.workspace }}/my-app'
```

### SBOM Attestation

To create an SBOM attestation, provide the path to an SPDX or CycloneDX JSON
file:

```yaml
- name: Generate SBOM
  run: syft . -o spdx-json > sbom.spdx.json

- uses: actions/attest@v4
  with:
    subject-path: '${{ github.workspace }}/my-app'
    sbom-path: '${{ github.workspace }}/sbom.spdx.json'
```

### Custom Attestation

For custom attestations, provide your own predicate type and content:

```yaml
- uses: actions/attest@v4
  with:
    subject-path: '${{ github.workspace }}/my-app'
    predicate-type: 'https://example.com/predicate/v1'
    predicate: '{}'
```

### Identify Multiple Subjects

If you are generating multiple artifacts, you can attest all of them at the same
time by using a wildcard in the `subject-path` input.

```yaml
- uses: actions/attest@v4
  with:
    subject-path: 'dist/**/my-bin-*'
    predicate-type: 'https://example.com/predicate/v1'
    predicate: '{}'
```

For supported wildcards along with behavior and documentation, see
[@actions/glob][8] which is used internally to search for files.

Alternatively, you can explicitly list multiple subjects with either a comma or
newline delimited list:

```yaml
- uses: actions/attest@v4
  with:
    subject-path: 'dist/foo, dist/bar'
```

```yaml
- uses: actions/attest@v4
  with:
    subject-path: |
      dist/foo
      dist/bar
```

### Identify Subjects with Checksums File

If you are using tools like
[goreleaser](https://goreleaser.com/customization/checksum/) or
[jreleaser](https://jreleaser.org/guide/latest/reference/checksum.html) which
generate a checksums file you can identify the attestation subjects by passing
the path of the checksums file to the `subject-checksums` input. Each of the
artifacts identified in the checksums file will be listed as a subject for the
attestation.

```yaml
- name: Calculate artifact digests
  run: |
    shasum -a 256 foo_0.0.1_* > subject.checksums.txt

- uses: actions/attest@v4
  with:
    subject-checksums: subject.checksums.txt
```

<!-- markdownlint-disable MD038 -->

The file referenced by the `subject-checksums` input must conform to the same
format used by the shasum tools. Each subject should be listed on a separate
line including the hex-encoded digest (either SHA256 or SHA512), a space, a
single character flag indicating either binary (`*`) or text (` `) input mode,
and the filename.

<!-- markdownlint-enable MD038 -->

```text
b569bf992b287f55d78bf8ee476497e9b7e9d2bf1c338860bfb905016218c740  foo_0.0.1_darwin_amd64
a54fc515e616cac7fcf11a49d5c5ec9ec315948a5935c1e11dd610b834b14dde  foo_0.0.1_darwin_arm64
```

### Container Image

When working with container images you can invoke the action with the
`subject-name` and `subject-digest` inputs.

If you want to publish the attestation to the container registry with the
`push-to-registry` option, it is important that the `subject-name` specify the
fully-qualified image name (e.g. "ghcr.io/user/app" or
"acme.azurecr.io/user/app"). Do NOT include a tag as part of the image name --
the specific image being attested is identified by the supplied digest.

#### Artifact Metadata Storage Records

When generating a build provenance attestation, if the `push-to-registry` option
is set to true, the Action will also emit an
[Artifact Metadata Storage Record](https://docs.github.com/en/rest/orgs/artifact-metadata?apiVersion=2022-11-28#create-artifact-metadata-storage-record).
Storage records enrich artifact metadata by capturing storage related details,
such as which registry an image is hosted on and whether it's marked as active.

If you do not want to emit a storage record, set `create-storage-record` to
`false`.

> **NOTE**: Storage records can only be created for artifacts built from
> [organization-owned](https://docs.github.com/en/organizations/collaborating-with-groups-in-organizations/about-organizations)
> repositories.

Artifacts associated with a storage record can be viewed by navigating to the
`Linked Artifacts` page in your organization:
`https://github.com/orgs/YOUR_ORG/artifacts` (replace `YOUR_ORG` with your
organization name).

> **NOTE**: When pushing to Docker Hub, please use "docker.io" as the registry
> portion of the image name.

```yaml
name: build-attested-image

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      packages: write
      contents: read
      attestations: write
      artifact-metadata: write
    env:
      REGISTRY: ghcr.io
      IMAGE_NAME: ${{ github.repository }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Login to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - name: Build and push image
        id: push
        uses: docker/build-push-action@v5.0.0
        with:
          context: .
          push: true
          tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
      - name: Attest
        uses: actions/attest@v4
        id: attest
        with:
          subject-name: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          subject-digest: ${{ steps.push.outputs.digest }}
          push-to-registry: true
```

[1]: https://github.com/actions/toolkit/tree/main/packages/attest
[2]: https://github.com/in-toto/attestation/tree/main/spec/v1
[3]:
  https://github.com/in-toto/attestation/tree/main/spec/predicates#in-toto-attestation-predicates
[4]: https://www.sigstore.dev/
[5]: https://cli.github.com/manual/gh_attestation_verify
[6]:
  https://github.com/sigstore/protobuf-specs/blob/main/protos/sigstore_bundle.proto
[8]: https://github.com/actions/toolkit/tree/main/packages/glob#patterns
[9]:
  https://docs.github.com/en/actions/security-guides/using-artifact-attestations-to-establish-provenance-for-builds
[10]: https://slsa.dev/spec/v1.0/provenance
