If you mean **different parts of the world**, a clean way to look at it is by **World Bank regions** using the latest broadly comparable figures I found for **2023**:

* **North America:** **79 years** ([World Bank Open Data][1])
* **Europe & Central Asia:** **78 years** ([World Bank Open Data][2])
* **East Asia & Pacific:** **77 years** ([World Bank Open Data][2])
* **Latin America & Caribbean:** **76 years** ([World Bank Open Data][2])
* **South Asia:** **72 years** ([World Bank Open Data][2])
* **Middle East, North Africa, Afghanistan & Pakistan:** **72 years** ([World Bank Open Data][3])
* **Sub-Saharan Africa:** **62 years** ([World Bank Open Data][2])
* **World average:** **73 years** ([World Bank Open Data][4])

So the rough pattern is: **North America / Europe / East Asia highest, Sub-Saharan Africa lowest**, with the others in between. ([World Bank Open Data][1])

Tiny statistics gremlin warning: these are **population averages at birth**, not personal destiny. They also depend on how the world is split into regions, because different organizations use slightly different regional buckets. ([UNdata][5])

For your app, a neat design would be to let the user choose:

* **World average**
* **Region average**
* **Country average**
* or a **custom number**

That way the journal can switch between “global human default settings” and something more personal.

[1]: https://data.worldbank.org/country/north-america?utm_source=chatgpt.com "North America | Data"
[2]: https://data.worldbank.org/?locations=ZG-8S-Z4-Z7-ZJ "Data for Sub-Saharan Africa, South Asia, East Asia & Pacific, Europe & Central Asia, Latin America & Caribbean | Data"
[3]: https://data.worldbank.org/indicator/SP.DYN.LE00.IN?locations=ZQ&utm_source=chatgpt.com "Life expectancy at birth, total (years) - Middle East, North ..."
[4]: https://data.worldbank.org/indicator/SP.DYN.LE00.IN?locations=1W&utm_source=chatgpt.com "Life expectancy at birth, total (years) - World"
[5]: https://data.un.org/Data.aspx?d=PopDiv&f=variableID%3A68 "
	UNdata | record view | Life expectancy at birth for both sexes combined (years)
"
