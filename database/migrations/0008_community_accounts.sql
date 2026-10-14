-- SPDX-License-Identifier: GPL-3.0-only
-- Existing accounts start with no community records or balance.
CREATE TABLE community_profiles (
  uid TEXT PRIMARY KEY REFERENCES users(uid),
  avatar TEXT NOT NULL DEFAULT 'dimo' CHECK(avatar IN ('dimo','haifu','bishui','sailemu')),
  bio TEXT NOT NULL DEFAULT '' CHECK(length(bio)<=160),
  badge TEXT NOT NULL DEFAULT '', frame TEXT NOT NULL DEFAULT '', updated_at INTEGER NOT NULL
);
CREATE TABLE community_checkins (
  uid TEXT NOT NULL REFERENCES users(uid), day TEXT NOT NULL,
  daily_reward INTEGER NOT NULL CHECK(daily_reward BETWEEN 3 AND 7),
  streak_bonus INTEGER NOT NULL CHECK(streak_bonus IN (0,5)),
  streak INTEGER NOT NULL CHECK(streak>0), created_at INTEGER NOT NULL,
  PRIMARY KEY(uid,day),
  CHECK(day=strftime('%Y-%m-%d',created_at,'unixepoch','+8 hours')),
  CHECK(streak_bonus=CASE WHEN streak%7=0 THEN 5 ELSE 0 END)
);
CREATE INDEX community_checkins_day ON community_checkins(day,uid);
CREATE TABLE community_purchases (
  uid TEXT NOT NULL REFERENCES users(uid),item_id TEXT NOT NULL,price INTEGER NOT NULL,created_at INTEGER NOT NULL,
  PRIMARY KEY(uid,item_id),
  CHECK(price=CASE item_id WHEN 'badge-first' THEN 5 WHEN 'badge-cloud' THEN 25 WHEN 'badge-star' THEN 50 WHEN 'frame-sun' THEN 10 WHEN 'frame-night' THEN 30 ELSE -1 END AND price>0)
);
CREATE TABLE community_ledger (
  entry_id TEXT PRIMARY KEY,uid TEXT NOT NULL REFERENCES users(uid),kind TEXT NOT NULL CHECK(kind IN ('checkin','redeem')),
  amount INTEGER NOT NULL CHECK((kind='checkin' AND amount BETWEEN 3 AND 12) OR (kind='redeem' AND amount<0)),
  ref TEXT NOT NULL,label TEXT NOT NULL,created_at INTEGER NOT NULL,UNIQUE(uid,kind,ref)
);
CREATE INDEX community_ledger_owner ON community_ledger(uid,created_at);
CREATE TRIGGER community_checkin_closed_day BEFORE INSERT ON community_checkins
WHEN EXISTS(SELECT 1 FROM community_checkins WHERE uid=NEW.uid AND day>NEW.day)
BEGIN SELECT RAISE(ABORT,'COMMUNITY_DAY_CHANGED'); END;
CREATE TRIGGER community_checkin_streak BEFORE INSERT ON community_checkins
WHEN NEW.streak!=COALESCE((SELECT CASE WHEN day=date(NEW.day,'-1 day') THEN streak+1 ELSE 1 END FROM community_checkins WHERE uid=NEW.uid AND day<NEW.day ORDER BY day DESC LIMIT 1),1)
BEGIN SELECT RAISE(ABORT,'COMMUNITY_STREAK_CHANGED'); END;
CREATE TRIGGER community_checkin_credit AFTER INSERT ON community_checkins BEGIN
  INSERT INTO community_ledger(entry_id,uid,kind,amount,ref,label,created_at)
  VALUES('checkin:'||NEW.uid||':'||NEW.day,NEW.uid,'checkin',NEW.daily_reward+NEW.streak_bonus,NEW.day,
    CASE WHEN NEW.streak_bonus>0 THEN '每日 '||NEW.daily_reward||' 枚 · 连续 '||NEW.streak||' 天额外 +5' ELSE '每日签到 · '||NEW.daily_reward||' 枚' END,NEW.created_at);
END;
CREATE TRIGGER community_purchase_balance BEFORE INSERT ON community_purchases
WHEN NOT EXISTS(SELECT 1 FROM community_purchases WHERE uid=NEW.uid AND item_id=NEW.item_id)
AND COALESCE((SELECT sum(amount) FROM community_ledger WHERE uid=NEW.uid),0)<NEW.price
BEGIN SELECT RAISE(ABORT,'INSUFFICIENT_MARKS'); END;
CREATE TRIGGER community_purchase_debit AFTER INSERT ON community_purchases BEGIN
  INSERT INTO community_ledger(entry_id,uid,kind,amount,ref,label,created_at)
  VALUES('redeem:'||NEW.uid||':'||NEW.item_id,NEW.uid,'redeem',-NEW.price,NEW.item_id,'兑换纪念物',NEW.created_at);
END;
CREATE TRIGGER community_checkins_no_update BEFORE UPDATE ON community_checkins BEGIN SELECT RAISE(ABORT,'immutable check-in'); END;
CREATE TRIGGER community_checkins_no_delete BEFORE DELETE ON community_checkins BEGIN SELECT RAISE(ABORT,'immutable check-in'); END;
CREATE TRIGGER community_purchases_no_update BEFORE UPDATE ON community_purchases BEGIN SELECT RAISE(ABORT,'immutable purchase'); END;
CREATE TRIGGER community_purchases_no_delete BEFORE DELETE ON community_purchases BEGIN SELECT RAISE(ABORT,'immutable purchase'); END;
CREATE TRIGGER community_ledger_no_update BEFORE UPDATE ON community_ledger BEGIN SELECT RAISE(ABORT,'append-only community ledger'); END;
CREATE TRIGGER community_ledger_no_delete BEFORE DELETE ON community_ledger BEGIN SELECT RAISE(ABORT,'append-only community ledger'); END;

CREATE TABLE community_comments (
  comment_id TEXT PRIMARY KEY,author_uid TEXT NOT NULL REFERENCES users(uid),page TEXT NOT NULL,title TEXT NOT NULL,
  body TEXT NOT NULL CHECK(length(body) BETWEEN 2 AND 2000),created_at INTEGER NOT NULL,removed_at INTEGER,
  request_key TEXT NOT NULL,request_hash TEXT NOT NULL,UNIQUE(author_uid,request_key)
);
CREATE INDEX community_comments_page ON community_comments(page,created_at);
CREATE INDEX community_comments_author ON community_comments(author_uid,created_at);
CREATE TABLE community_likes (
  uid TEXT NOT NULL REFERENCES users(uid),target_type TEXT NOT NULL CHECK(target_type IN ('comment','guide')),
  target_id TEXT NOT NULL,first_at INTEGER NOT NULL,active INTEGER NOT NULL CHECK(active IN (0,1)),
  PRIMARY KEY(uid,target_type,target_id)
);
CREATE INDEX community_likes_target ON community_likes(target_type,target_id,active);
