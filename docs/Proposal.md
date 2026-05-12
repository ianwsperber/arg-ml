# Proposal: ArgML Spec for Efficient Double-Cruxing

ArgML was motivated by a long afternoon conversation, in which a friend expressed his frustration with the ambiguity of philosophy. My friend did not suppose that Philosophy needed the same confidence in its conclusions as Math or Logic, but did feel that Philosophy spent an inordinate amount of time arguing over _terms_. Indeed, it seemed to him that the majority of philosophical debate could be resolved if the participants only realized they were talking about two different definitions of the same concepts, so really their disagreements were only superficial. How much _nicer_ it would be if Philosophers were more like Mathematicians, who can convert a proof to Lean when they want a verifiable formalization of their views!

The rationalist community already has practices like [double-crux](https://www.lesswrong.com/w/double-crux) meant to cut to the heart of disagreement between two parties. However this practice is intended primarily for peer-to-peer communication. When reading a paper, post or book, we have no way of verifying the "cruxes" of an argument, the implicit use of terms or any of the underlying assumptions. Is there any way we could make this explicit in a text?

We believe that it very much _is_ possible to surface these points explicitly, in a way that is low effort for an author and sufficiently high value for a reader. We suggest that one could define a simple XML markup language that surfaces the key points of any argument and allows referencing terms from other works, in a way that will elucidate the cruxes of any argument. While this approach has been technically feasible for a long time, it is only with modern LLMs that the cost of implementing formal markup is low enough to justify implementation.

Our early draft of ArgML is a first attempt to address the common problems an open-minded, rational thinker:

1. How can I quickly assess an textual argument's key claims and assumptions?
1. How do I reduce time wasted on semantic disagreement?
1. How do I propagate updates to my worldview after revising a belief?
1. How can I increase my confidence in machine-generated research and arguments?

Our syntax takes inspiration from existing specifications in argument theory and formal logic. We have aimed for a balance between usability and utility in our approach. While a fully verifiable system would be nice, we suspect this would require a level of complexity strictly out of scope for this project, and possible infeasible when working with natural language.

Our hope is that ArgML is easy enough to work with, and quick enough to add to any text, that we could feasibly implement it for a wide variety of texts and standard definitions. In time, we'd hope that this creates an ecosystem that would allow any author to import standard sets of assumptions and terms for their arguments. This would then allow for machine propagation of "beliefs" to relevant texts, based on personal assessment of relevant assumptions and cruxes. Imagine if you had already marked a disagreement with one standard assumption. When encountering a text which leaned on that assumption, you could identify immediately that your disagreement was not with any of the claims in the text, but the foundations of the argument itself!

We believe a formal syntax for argumentation will become increasingly important as research and writing shifts increasingly to AI. AIs are a powerful tool for accelerating research, but with a scalable strategy to check an agent's claims are well-founded, then they will remain hard to trust. While we do not provide a formal system for verification of an argument, our syntax could help to check an argument is well-structured and evidence-based, or provide machine-assistance in assessing claims.

## FAQ

### Why did you create a new specification? Wasn't there something else you could have used?

We would have much preferred not to create something new! But existing specifications are very formal and a bad fit for unstructured prose.

### Isn't formal specification a lot of work for little benefit?

In the past, we would have agreed! But LLMs drastically reduce the cost of producing a formal specification for any text. We don't recommend writing ArgML from scratch. We expect you'll programmatically generate an ArgML document using AI.
