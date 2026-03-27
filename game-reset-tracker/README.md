# Game Reset Tracker

Game Reset Tracker helps you keep up with repeatable game tasks in one place. You can track dailies, weeklies, one-time tasks, and limited-time events across multiple games without needing an account or backend.

## What This App Does

Use the tracker to:

- keep all of your recurring game tasks in one place
- group tasks by game and by category
- see what is available, done, expired, or about to reset
- filter the list down to exactly what you want to work on
- edit games, groups, and tasks directly in the app
- import, export, and back up your tracker data

## Main Areas

### Dashboard

The top of the page shows your current view and summary stats:

- `Visible`: tasks currently shown in the list
- `Available`: tasks you can do now
- `Done`: tasks already completed
- `Expired`: tasks that can no longer be completed

### Filters

Use the Filters panel to narrow the task list:

- by game
- by task type
- by task state
- by whether something is expiring soon
- by whether disabled tasks are hidden or shown
- by whether completed or expired tasks should be hidden
- by sort order

Use `Reset` in the Filters panel to return to the default view.

### Task List

The main list shows your tasks, grouped by context depending on your current view.

From the task list, you can:

- mark tasks complete
- undo a completed task
- disable or enable tasks
- edit tasks
- add tasks from the current context
- focus on a game or group
- export a group in focused views

### Games

The Games panel gives you quick navigation between:

- the full tracker view
- a specific game
- a specific group within a game

You can also:

- focus on a game
- edit a game
- export a game

### Editor

The Editor appears only when you are creating or editing something.

You can use it to:

- create a new game
- edit an existing game
- edit a group
- edit a task
- delete the item you are editing

## Task Types

The tracker supports four task types:

- `Daily`: resets every day at the configured daily reset time
- `Weekly`: resets on the configured weekly day and time
- `One-time`: does not automatically reset
- `Event`: useful for limited-time tasks with expiry dates

## Reset Rules

Each game can define reset settings. Groups and tasks can either:

- use the inherited reset settings
- override them with their own custom reset settings

This lets you handle games where most tasks share one reset schedule, while still supporting exceptions.

## What The Statuses Mean

- `Available`: ready to do
- `Done`: completed for the current cycle
- `Expired`: no longer available because the task or its parent expired

The tracker can also highlight items that are close to their next reset or expiry.

## Data And Backup

### Local Save

Your tracker is saved in your browser automatically. You do not need to manually save after every change.

### Export

You can export:

- your full tracker
- a single game
- a group from a focused view

Exports are saved as JSON files.

### Import

You can import tracker data in two ways:

- `Merge`: adds imported games to your current tracker
- `Replace`: replaces your current tracker completely

### Google Drive Backup

If Google Drive is configured, you can:

- connect your Google account
- save a backup to Drive
- load a backup from Drive
- disconnect from Google

## Demo Data

The app includes demo data so you can see how the tracker works before building your own setup.

Use `Restore demo` if you want to bring the sample data back.

## Good Ways To Organize Your Tracker

A simple structure that works well is:

- one `Game` for each game you play
- one `Group` for each activity bucket, such as Daily Core, Weekly Raids, Vendors, or Event Tasks
- one `Task` for each thing you actually want to remember to do

## Quick Start

1. Open the tracker in your browser.
2. Add a game, or start from the demo data.
3. Add groups and tasks.
4. Set reset rules at the game level first.
5. Override reset rules only where needed.
6. Use filters and focused views to keep the list manageable.

## Common Actions

### I want to add a new game

Use `Add game` in the Data panel.

### I want to edit something

Click an `Edit` button on the game, group, or task you want to change.

### I want to see only one game

Use `Focus` in the Games panel.

### I want to go back to everything

Use `Show all` in the Games panel.

### I want to back up my tracker

Use `Export tracker`, or save a backup to Google Drive if it is enabled.

### I want to start over

Use:

- `Reset progress` to clear completion progress
- `Restore demo` to bring back the sample tracker
- import with `Replace` to swap in a completely new tracker file

## Notes

- the tracker works without a backend
- your data stays in your browser unless you export it or send it to Google Drive
- the layout changes to fit desktop, tablet, and mobile widths
