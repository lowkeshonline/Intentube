# JEV Evaluation

`jevDataset.ts` contains 50 provisional examples: 17 music, 17 technology, and 16 education. Review the expected labels before treating the metrics as ground truth.

The live evaluation calls JEV once per example. It reports accuracy, distraction precision and recall, and per-intent accuracy using the default 65% threshold. It does not change the classifier or cache.

Set `JEV_API_KEY` in your local shell, then run:

```sh
pnpm eval:jev
```

The regular `pnpm test` suite uses mocked API responses and does not send network requests.
