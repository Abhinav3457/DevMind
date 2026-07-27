/**
 * Cleanup script to find and delete a GitHub account record that's causing
 * "already connected to another user" errors.
 *
 * Usage:
 *   1. Make sure your .env file or MONGODB_URI env var is set
 *   2. Run: node scripts/cleanup-github-account.mjs <githubId>
 *      Example: node scripts/cleanup-github-account.mjs 269326756
 */

import mongoose from 'mongoose';

const GITHUB_ID = process.argv[2];

if (!GITHUB_ID) {
  console.error('❌ Usage: node scripts/cleanup-github-account.mjs <githubId>');
  console.error('   Example: node scripts/cleanup-github-account.mjs 269326756');
  process.exit(1);
}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/devmind-ai';

async function cleanup() {
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.log(`✅ Connected to: ${mongoose.connection.host}`);
    console.log(`   Database: ${mongoose.connection.db.databaseName}`);

    const db = mongoose.connection.db;

    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('\n📋 Collections in database:');
    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments();
      console.log(`   - ${col.name}: ${count} documents`);
    }

    // Search for the GitHub account
    const gitHubAccountsCol = db.collection('githubaccounts');
    const account = await gitHubAccountsCol.findOne({ githubId: parseInt(GITHUB_ID, 10) });

    console.log(`\n🔍 Searching for GitHub account with githubId: ${GITHUB_ID}`);

    if (account) {
      console.log('\n✅ Found record:');
      console.log(JSON.stringify(account, null, 2));

      // Show all accounts with the same githubId (should be 1)
      const allMatching = await gitHubAccountsCol.find({ githubId: parseInt(GITHUB_ID, 10) }).toArray();
      console.log(`\n📊 Total records with this githubId: ${allMatching.length}`);

      // Show ALL GitHubAccount records to see what's there
      const allAccounts = await gitHubAccountsCol.find({}).toArray();
      console.log(`\n📊 All GitHubAccount records (${allAccounts.length} total):`);
      for (const acc of allAccounts) {
        const userId = acc.userId ? acc.userId.toString() : 'N/A';
        console.log(`   - _id: ${acc._id}, userId: ${userId}, githubId: ${acc.githubId}, login: ${acc.login}, isConnected: ${acc.isConnected}`);
      }

      // Delete the record
      console.log('\n🗑️  Deleting the record...');
      const result = await gitHubAccountsCol.deleteOne({ _id: account._id });
      if (result.deletedCount === 1) {
        console.log('✅ Successfully deleted the record!');
      } else {
        console.log('❌ Failed to delete the record.');
      }
    } else {
      console.log('❌ No record found in githubaccounts collection.');

      // Also show all accounts so user can see what's there
      const allAccounts = await gitHubAccountsCol.find({}).toArray();
      if (allAccounts.length > 0) {
        console.log(`\n📊 All GitHubAccount records (${allAccounts.length} total):`);
        for (const acc of allAccounts) {
          const userId = acc.userId ? acc.userId.toString() : 'N/A';
          console.log(`   - _id: ${acc._id}, userId: ${userId}, githubId: ${acc.githubId}, login: ${acc.login}, isConnected: ${acc.isConnected}`);
        }
      } else {
        console.log('\n📊 The githubaccounts collection is empty.');
        console.log('   This means the data might be in a DIFFERENT database.');
        console.log('   Check your MONGODB_URI environment variable.');
      }
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

cleanup();
