CREATE TABLE `connections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`access_token_encrypted` text NOT NULL,
	`refresh_token_encrypted` text,
	`user_id` text NOT NULL,
	`site_url` text,
	`last_sync_at` text,
	`last_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `connections_source_unique` ON `connections` (`source`);--> statement-breakpoint
CREATE TABLE `github_issues` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` text NOT NULL,
	`source_url` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text NOT NULL,
	`priority` text,
	`assignee` text,
	`labels` text,
	`group` text,
	`linked_items` text,
	`metadata` text,
	`summary` text,
	`summarized_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `github_issues_source_id_idx` ON `github_issues` (`source_id`);--> statement-breakpoint
CREATE TABLE `github_prs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` text NOT NULL,
	`source_url` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text NOT NULL,
	`action_needed` text,
	`assignee` text,
	`labels` text,
	`group` text,
	`linked_items` text,
	`metadata` text,
	`summary` text,
	`summarized_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `github_prs_source_id_idx` ON `github_prs` (`source_id`);--> statement-breakpoint
CREATE TABLE `jira_tickets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` text NOT NULL,
	`source_url` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text NOT NULL,
	`priority` text,
	`assignee` text,
	`labels` text,
	`group` text,
	`linked_items` text,
	`metadata` text,
	`summary` text,
	`summarized_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jira_tickets_source_id_idx` ON `jira_tickets` (`source_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`value` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settings_key_unique` ON `settings` (`key`);--> statement-breakpoint
CREATE TABLE `todos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`text` text NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`completed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
