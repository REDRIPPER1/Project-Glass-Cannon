# ReadQuest API

The API is optional. The browser imports the reviewed files in `backend/data/`
directly, so a learner can complete every bundled quest when this service is
offline.

## `GET /api/health`

Returns the service status.

```json
{"status":"ok","service":"ReadQuest API"}
```

## `GET /api/quests`

Returns compact reviewed-quest cards. Each card includes its ID, display
metadata, skill tags, and the source rights label/attribution needed by a
catalog view. Passage text and answer keys are intentionally omitted.

## `GET /api/quests/{quest_id}`

Returns the exact reviewed object from `backend/data/quest-*.json`. Its shape
matches the browser's bundled JSON contract.

An unknown ID returns HTTP 404:

```json
{
  "detail": {
    "code": "quest_not_found",
    "message": "No reviewed quest exists with ID '...'."
  }
}
```

If a bundled file is missing, unreadable, or fails validation, list and detail
requests return HTTP 503 with `detail.code` set to
`quest_content_unavailable`. The response deliberately omits internal
validation details; the server log and test suite identify the broken field.

## Reviewed content boundary

Every `quest-*.json` is validated before the API serves any quest. Validation
checks source/rights metadata, a 200–250 word passage, stable sentence IDs,
three same-skill multiple-choice questions, answer keys, worked-example and
question evidence IDs, exact evidence text, and structured story
consequences.
